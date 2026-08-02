import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PetMachine, type PetRoms } from './petMachine';
import { READ_BIT, WRITE_BIT } from '../memoryActivityBuffer';
import { tokenizeProgram } from '../../dialects/pet/tokenizer';

const ROOT = join(__dirname, '../../../public/roms/pet');
const roms: PetRoms = {
  basicB: readFileSync(join(ROOT, 'basic-4-b000.901465-23.bin')),
  basicC: readFileSync(join(ROOT, 'basic-4-c000.901465-20.bin')),
  basicD: readFileSync(join(ROOT, 'basic-4-d000.901465-21.bin')),
  editor: readFileSync(join(ROOT, 'edit-4-40-n-50Hz.901498-01.bin')),
  kernal: readFileSync(join(ROOT, 'kernal-4.901465-22.bin')),
  character: readFileSync(join(ROOT, 'characters-2.901447-10.bin')),
};

/**
 * Booting the real ROMs and running frames is slow, so give these cases a
 * generous per-test budget (the boot dominates every one).
 */
const BOOT_TIMEOUT_MS = 20_000;

const SCREEN_BASE = 0x8000;

/** Read `len` screen-RAM cells as screen codes. */
function screen(m: PetMachine, len = 1000): number[] {
  const out: number[] = [];
  for (let i = 0; i < len; i++) out.push(m.peek(SCREEN_BASE + i) & 0x7f);
  return out;
}

/** Screen codes: A–Z are 1–26, '0'–'9' are 48–57, '.' is 46, space is 32. */
function screenCodes(s: string): number[] {
  return [...s].map((ch) => {
    if (ch >= 'A' && ch <= 'Z') return ch.charCodeAt(0) - 64;
    if (ch >= '0' && ch <= '9') return ch.charCodeAt(0);
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

/** Build the injectable .prg image (load address + tokenized program). */
function image(source: string): Uint8Array {
  const { program, errors } = tokenizeProgram(source);
  expect(errors).toEqual([]);
  return Uint8Array.from([0x01, 0x04, ...program]);
}

describe('PetMachine', () => {
  it(
    'boots the BASIC 4.0 ROMs to the READY. prompt',
    async () => {
      const m = new PetMachine({ roms });
      await m.whenReady();
      for (let i = 0; i < 200; i++) m.runFrame();
      expect(contains(screen(m), screenCodes('READY.'))).toBe(true);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'reports the 31743-byte free memory figure at boot',
    async () => {
      const m = new PetMachine({ roms });
      await m.whenReady();
      for (let i = 0; i < 200; i++) m.runFrame();
      // The BASIC 4.0 banner reads "31743 BYTES FREE".
      expect(contains(screen(m), screenCodes('31743 BYTES FREE'))).toBe(true);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'injects and runs a program that pokes the screen',
    async () => {
      const m = new PetMachine({ roms });
      await m.whenReady();
      // POKE the screen-code for 'A' (1) into the top-left screen cell, then
      // sit in a loop so the value stays put while we sample it.
      m.loadProgram(image('10 POKE 32768,1\n20 GOTO 20\n'));
      // loadProgram boots + injects synchronously on the ready microtask; run
      // frames to let RUN take and the program execute.
      await m.whenReady();
      for (let i = 0; i < 200; i++) m.runFrame();
      expect(m.peek(SCREEN_BASE)).toBe(1);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'runs a PRINT program and shows its output on screen',
    async () => {
      const m = new PetMachine({ roms });
      await m.whenReady();
      m.loadProgram(image('10 PRINT "HI"\n'));
      await m.whenReady();
      for (let i = 0; i < 200; i++) m.runFrame();
      expect(contains(screen(m), screenCodes('HI'))).toBe(true);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  // ---- Stage 5 — watcher / report / debugger / audio ----------------------

  it(
    'reads real, integer and string variables from a running program',
    async () => {
      const m = new PetMachine({ roms });
      await m.whenReady();
      m.loadProgram(image('10 A=5\n20 B%=7\n30 C$="HI"\n40 GOTO 40\n'));
      await m.whenReady();
      for (let i = 0; i < 100; i++) m.runFrame();
      const vars = m.readVariables();
      expect(vars).toContainEqual(
        expect.objectContaining({ name: 'A', kind: 'number', value: '5' }),
      );
      expect(vars).toContainEqual(
        expect.objectContaining({ name: 'B%', kind: 'number', value: '7' }),
      );
      expect(vars).toContainEqual(
        expect.objectContaining({ name: 'C$', kind: 'string', value: '"HI"' }),
      );
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'reports a runtime error (with its line) through readReport',
    async () => {
      const m = new PetMachine({ roms });
      await m.whenReady();
      // ?UNDEF'D STATEMENT  ERROR IN 10, straight back to READY.
      m.loadProgram(image('10 GOTO 999\n'));
      await m.whenReady();
      for (let i = 0; i < 100; i++) m.runFrame();
      const report = m.readReport();
      expect(report).not.toBeNull();
      expect(report!.isError).toBe(true);
      expect(report!.message).toContain("UNDEF'D STATEMENT");
      expect(report!.line).toBe(10);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'tracks the current BASIC line and pauses on step and breakpoints',
    async () => {
      const m = new PetMachine({ roms });
      await m.whenReady();
      // The 20/30 reads below are the empirical check that CURLIN is $36/$37
      // on the real BASIC 4.0 ROMs (a wrong cell would not track the loop).
      // Note the 4.0 ROM leaves CURLIN at $0000 from power-on rather than the
      // C64's $FFxx direct-mode sentinel, so there is no null-at-READY check.
      m.loadProgram(image('10 X=0\n20 X=X+1\n30 GOTO 20\n'));
      await m.whenReady();
      for (let i = 0; i < 50; i++) m.runFrame();
      const line = m.currentLine();
      expect([20, 30]).toContain(line);

      // Step: pause as soon as execution reaches a different line.
      const step = m.debugStep({
        mode: 'step',
        breakpoints: new Set<number>(),
        fromLine: line,
      });
      expect(step.paused).toBe(true);
      expect(step.line).not.toBe(line);
      expect([20, 30]).toContain(step.line);

      // Run: pause when the loop comes back around to a breakpointed line.
      const breakpoints = new Set([20]);
      let hit = m.debugStep({ mode: 'run', breakpoints, fromLine: step.line });
      for (let i = 0; i < 20 && !hit.paused; i++) {
        hit = m.debugStep({ mode: 'run', breakpoints, fromLine: step.line });
      }
      expect(hit.paused).toBe(true);
      expect(hit.line).toBe(20);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'sounds the CB2 line from the POKE recipe and settles when disabled',
    async () => {
      const m = new PetMachine({ roms });
      await m.whenReady();
      expect(m.audioSampleRate).toBe(44100);
      // The classic recipe: shift register free-running out ($0F pattern) at
      // the T2 rate, held for a FOR/NEXT delay, then switched off again.
      m.loadProgram(
        image(
          '10 POKE 59467,16\n' +
            '20 POKE 59466,15\n' +
            '30 POKE 59464,100\n' +
            '40 FOR I=1 TO 200\n' +
            '50 NEXT I\n' +
            '60 POKE 59467,0\n' +
            '70 GOTO 70\n',
        ),
      );
      await m.whenReady();
      let peak = 0;
      for (let i = 0; i < 400; i++) {
        m.runFrame();
        for (const s of m.readAudio()) peak = Math.max(peak, Math.abs(s));
      }
      expect(peak).toBeGreaterThan(0.1);
      // By now line 60 has run: the line is silent and frames are empty again.
      m.runFrame();
      expect(m.readAudio().length).toBe(0);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  describe('memory-activity recording', () => {
    it(
      'records CPU reads and writes, including the screen region, while enabled',
      async () => {
        const m = new PetMachine({ roms });
        // Off by default: nothing to drain until recording is armed.
        expect(m.drainMemoryActivity()).toBeNull();
        await m.whenReady();
        m.setMemoryActivityRecording(true);
        // POKE the top-left screen cell ($8000 = 32768), then loop so the write
        // is made while we are sampling.
        m.loadProgram(image('10 POKE 32768,1\n20 GOTO 20\n'));
        await m.whenReady();
        for (let i = 0; i < 200; i++) m.runFrame();
        const hits = m.drainMemoryActivity();
        expect(hits).not.toBeNull();
        expect(hits!.length).toBe(0x10000);
        // The POKE 32768 write landed in the screen RAM region.
        expect(hits![0x8000]! & WRITE_BIT).toBe(WRITE_BIT);
        // The running interpreter reads memory constantly.
        expect(hits!.some((b) => (b & READ_BIT) !== 0)).toBe(true);
        m.dispose();
      },
      BOOT_TIMEOUT_MS,
    );

    it(
      'stops recording and drains null once disabled',
      async () => {
        const m = new PetMachine({ roms });
        await m.whenReady();
        m.setMemoryActivityRecording(true);
        for (let i = 0; i < 50; i++) m.runFrame();
        m.setMemoryActivityRecording(false);
        expect(m.drainMemoryActivity()).toBeNull();
        m.dispose();
      },
      BOOT_TIMEOUT_MS,
    );
  });
  describe('run state', () => {
    /**
     * Sample isProgramRunning() once per frame from the moment the program is
     * handed over, so the hand-over itself is observable and not just the
     * settled state. CURLIN deliberately isn't consulted: the ROM leaves it
     * holding the last line executed once a program stops.
     */
    async function trace(
      source: string,
      frames = 500,
    ): Promise<(boolean | null)[]> {
      const m = new PetMachine({ roms });
      await m.whenReady();
      m.loadProgram(image(source));
      await m.whenReady();
      const seen: (boolean | null)[] = [];
      for (let i = 0; i < frames; i++) {
        m.runFrame();
        seen.push(m.isProgramRunning());
      }
      m.dispose();
      return seen;
    }

    it(
      'reports a looping program as running',
      async () => {
        expect((await trace('10 GOTO 10\n')).at(-1)).toBe(true);
      },
      BOOT_TIMEOUT_MS,
    );

    it(
      'reports a finished program as not running',
      async () => {
        expect((await trace('10 PRINT "HI"\n')).at(-1)).toBe(false);
      },
      BOOT_TIMEOUT_MS,
    );

    it(
      'never reads as finished before the program has started',
      async () => {
        // Everything up to the first `true` must be "not answerable yet" - a
        // `false` there would report a program that has not begun as ended.
        const seen = await trace('10 GOTO 10\n');
        const started = seen.indexOf(true);
        expect(started).toBeGreaterThanOrEqual(0);
        expect(seen.slice(0, started)).not.toContain(false);
      },
      BOOT_TIMEOUT_MS,
    );
  });
});
