import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { C64Machine, type C64Roms } from './c64Machine';
import { commodore64 } from '../../dialects/commodore64';

const ROOT = join(__dirname, '../../../public/roms/c64');
const roms: C64Roms = {
  basic: readFileSync(join(ROOT, 'basic.bin')),
  kernal: readFileSync(join(ROOT, 'kernal.bin')),
  character: readFileSync(join(ROOT, 'chargen.bin')),
};

/**
 * Booting the real C64 ROMs and running a few hundred frames is slow (~2–5s per
 * test) and can edge past vitest's 5s default under load, so give these a
 * generous per-test budget. The boot dominates every case, so it's applied
 * uniformly.
 */
const BOOT_TIMEOUT_MS = 20_000;

/** Read `len` bytes of screen RAM ($0400) as C64 screen codes. */
function screen(m: C64Machine, len = 1000): number[] {
  const c64 = m.machine!;
  const out: number[] = [];
  for (let i = 0; i < len; i++) out.push(c64.wires.cpuRead(0x0400 + i));
  return out;
}

/** Read a single byte off the CPU bus (e.g. a CIA register). */
function peek(m: C64Machine, addr: number): number {
  return m.machine!.wires.cpuRead(addr);
}

const NEUTRAL = {
  up: false,
  down: false,
  left: false,
  right: false,
  fire1: false,
  fire2: false,
};

/** Screen codes: A–Z are 1–26, '.' is 46, space is 32. */
function screenCodes(s: string): number[] {
  return [...s].map((ch) => {
    if (ch >= 'A' && ch <= 'Z') return ch.charCodeAt(0) - 64;
    if (ch === '.') return 46;
    return 32;
  });
}

function contains(haystack: number[], needle: number[]): boolean {
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

describe('C64Machine', () => {
  it(
    'boots the real ROMs to the READY. prompt',
    async () => {
      const m = new C64Machine({ roms });
      await m.whenReady();
      for (let i = 0; i < 200; i++) m.runFrame();
      expect(contains(screen(m), screenCodes('READY.'))).toBe(true);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'loads and runs a program tokenized by the dialect',
    async () => {
      const { image, errors } = commodore64.tokenize('10 PRINT "HELLO"\n');
      expect(errors).toEqual([]);
      const m = new C64Machine({ roms });
      await m.whenReady();
      m.loadProgram(image);
      // loadProgram queues its boot+inject on a microtask; let it finish.
      await new Promise((r) => setTimeout(r, 0));
      for (let i = 0; i < 300; i++) m.runFrame();
      expect(contains(screen(m), screenCodes('HELLO'))).toBe(true);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'takes more frames to finish the same program at a slower speed',
    async () => {
      // A busy loop long enough that its completion spans many frames, so
      // the run (not just boot) is what setSpeed throttles.
      const src = '10 FOR I=1 TO 1000\n20 NEXT I\n30 PRINT "DONE"\n';
      async function framesToDone(speed: number): Promise<number> {
        const { image, errors } = commodore64.tokenize(src);
        expect(errors).toEqual([]);
        const m = new C64Machine({ roms });
        await m.whenReady();
        m.loadProgram(image);
        await new Promise((r) => setTimeout(r, 0));
        m.setSpeed(speed);
        for (let i = 1; i <= 2000; i++) {
          m.runFrame();
          if (contains(screen(m), screenCodes('DONE'))) {
            m.dispose();
            return i;
          }
        }
        throw new Error('never displayed DONE');
      }
      const atFullSpeed = await framesToDone(1);
      const atHalfSpeed = await framesToDone(0.5);
      expect(atHalfSpeed).toBeGreaterThan(atFullSpeed);
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'detects a runtime error after running a buggy program',
    async () => {
      // GOTO a non-existent line raises ?UNDEF'D STATEMENT ERROR.
      const { image, errors } = commodore64.tokenize('10 GOTO 999\n');
      expect(errors).toEqual([]);
      const m = new C64Machine({ roms });
      await m.whenReady();
      m.loadProgram(image);
      await new Promise((r) => setTimeout(r, 0));
      for (let i = 0; i < 400; i++) m.runFrame();
      const report = m.readReport();
      expect(report).not.toBeNull();
      expect(report!.isError).toBe(true);
      expect(report!.message).toContain('ERROR');
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'reports no error after a clean program',
    async () => {
      const { image } = commodore64.tokenize('10 PRINT "HELLO"\n');
      const m = new C64Machine({ roms });
      await m.whenReady();
      m.loadProgram(image);
      await new Promise((r) => setTimeout(r, 0));
      for (let i = 0; i < 400; i++) m.runFrame();
      expect(m.readReport()).toBeNull();
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  describe('native joystick (port 2 / $dc00)', () => {
    it(
      'drives the games port active-low from setJoystick',
      async () => {
        const m = new C64Machine({ roms });
        await m.whenReady();
        for (let i = 0; i < 200; i++) m.runFrame();
        // Idle: all five switches float high (bits 0-4 set).
        m.setJoystick('native', NEUTRAL);
        expect(peek(m, 0xdc00) & 0x1f).toBe(0x1f);
        // Left (bit2) + fire (bit4) pressed pull their lines low.
        m.setJoystick('native', { ...NEUTRAL, left: true, fire1: true });
        expect(peek(m, 0xdc00) & 0x1f).toBe(0x1f & ~(0x04 | 0x10));
        // fire2 folds onto the single fire line on the C64.
        m.setJoystick('native', { ...NEUTRAL, fire2: true });
        expect(peek(m, 0xdc00) & 0x10).toBe(0);
        m.dispose();
      },
      BOOT_TIMEOUT_MS,
    );
  });

  describe('step-through debugging', () => {
    // A tight loop whose executing line cycles 20 → 30 → 20, so a breakpoint on
    // 20 trips almost as soon as the program is running.
    const LOOP_SRC = '10 FOR I=1 TO 1000\n20 A=I\n30 NEXT I\n';

    async function loadLoop(): Promise<C64Machine> {
      const { image, errors } = commodore64.tokenize(LOOP_SRC);
      expect(errors).toEqual([]);
      const m = new C64Machine({ roms });
      await m.whenReady();
      m.loadProgram(image);
      await new Promise((r) => setTimeout(r, 0));
      // Boot + auto-RUN, then run on until execution is inside the loop.
      for (let i = 0; i < 400; i++) {
        m.runFrame();
        const line = m.currentLine();
        if (line === 10 || line === 20 || line === 30) break;
      }
      return m;
    }

    /** Drive debugStep slices until one pauses, or give up. */
    function runToPause(
      m: C64Machine,
      mode: 'run' | 'step',
      breakpoints: Set<number>,
      fromLine: number | null,
    ) {
      for (let i = 0; i < 5000; i++) {
        const res = m.debugStep({ breakpoints, mode, fromLine });
        if (res.paused) return res;
      }
      throw new Error('debugStep never paused');
    }

    it(
      'reports a current line inside the running program',
      async () => {
        const m = await loadLoop();
        const line = m.currentLine();
        expect(line === 10 || line === 20 || line === 30).toBe(true);
        m.dispose();
      },
      BOOT_TIMEOUT_MS,
    );

    it(
      'pauses at a breakpointed line, then steps to the next',
      async () => {
        const m = await loadLoop();
        const hit = runToPause(m, 'run', new Set([20]), null);
        expect(hit).toEqual({ paused: true, line: 20 });
        const stepped = runToPause(m, 'step', new Set(), 20);
        expect(stepped.paused).toBe(true);
        expect(stepped.line).toBe(30);
        m.dispose();
      },
      BOOT_TIMEOUT_MS,
    );
  });
});
