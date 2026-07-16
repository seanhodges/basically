import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Vic20Machine } from './vic20Machine';
import type { Vic20Roms } from './memory';
import { READ_BIT, WRITE_BIT } from '../memoryActivityBuffer';
import { tokenizeProgram } from '../../dialects/vic20/tokenizer';

const ROOT = join(__dirname, '../../../public/roms/vic20');
const roms: Vic20Roms = {
  basic: readFileSync(join(ROOT, 'basic.bin')),
  kernal: readFileSync(join(ROOT, 'kernal.bin')),
  character: readFileSync(join(ROOT, 'chargen.bin')),
};

/** Booting the real ROMs and running frames is slow; give a generous budget. */
const BOOT_TIMEOUT_MS = 20_000;

const SCREEN_BASE = 0x1e00;
const SCREEN_CELLS = 22 * 23;

/** Read the visible screen matrix as screen codes (high reverse-video bit off). */
function screen(m: Vic20Machine, len = SCREEN_CELLS): number[] {
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

/** Build the injectable .prg image (load address $1001 + tokenized program). */
function image(source: string): Uint8Array {
  const { program, errors } = tokenizeProgram(source);
  expect(errors).toEqual([]);
  return Uint8Array.from([0x01, 0x10, ...program]);
}

describe('Vic20Machine', () => {
  it(
    'boots the BASIC V2 ROMs to the READY. prompt',
    async () => {
      const m = new Vic20Machine({ roms });
      await m.whenReady();
      for (let i = 0; i < 300; i++) m.runFrame();
      expect(contains(screen(m), screenCodes('READY.'))).toBe(true);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'reports the 3583-byte free memory figure at boot',
    async () => {
      const m = new Vic20Machine({ roms });
      await m.whenReady();
      for (let i = 0; i < 300; i++) m.runFrame();
      // The unexpanded VIC-20 banner reads "3583 BYTES FREE".
      expect(contains(screen(m), screenCodes('3583 BYTES FREE'))).toBe(true);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'injects and runs a program that pokes the screen',
    async () => {
      const m = new Vic20Machine({ roms });
      await m.whenReady();
      // POKE screen-code 'A' (1) into the top-left screen cell, then loop so the
      // value stays put while we sample it.
      m.loadProgram(image('10 POKE 7680,1\n20 GOTO 20\n'));
      await m.whenReady();
      for (let i = 0; i < 300; i++) m.runFrame();
      expect(m.peek(SCREEN_BASE)).toBe(1);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'runs a PRINT program and shows its output on screen',
    async () => {
      const m = new Vic20Machine({ roms });
      await m.whenReady();
      m.loadProgram(image('10 PRINT "HI"\n'));
      await m.whenReady();
      for (let i = 0; i < 300; i++) m.runFrame();
      expect(contains(screen(m), screenCodes('HI'))).toBe(true);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'reads real, integer and string variables from a running program',
    async () => {
      const m = new Vic20Machine({ roms });
      await m.whenReady();
      m.loadProgram(image('10 A=1.5\n20 B%=7\n30 C$="HI"\n40 GOTO 40\n'));
      await m.whenReady();
      for (let i = 0; i < 300; i++) m.runFrame();
      const byName = new Map(m.readVariables().map((v) => [v.name, v]));
      expect(byName.get('A')).toMatchObject({ kind: 'number', value: '1.5' });
      expect(byName.get('B%')).toMatchObject({ kind: 'number', value: '7' });
      expect(byName.get('C$')).toMatchObject({
        kind: 'string',
        value: '"HI"',
      });
      m.dispose();
      expect(m.readVariables()).toEqual([]);
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'detects a runtime error wrapped across the 22-column screen',
    async () => {
      // GOTO a non-existent line raises ?UNDEF'D STATEMENT ERROR IN 10 — a
      // 30-character line, so it spans two physical rows of the 22×23 matrix.
      const m = new Vic20Machine({ roms });
      await m.whenReady();
      m.loadProgram(image('10 GOTO 999\n'));
      await m.whenReady();
      for (let i = 0; i < 300; i++) m.runFrame();
      const report = m.readReport();
      expect(report).not.toBeNull();
      expect(report!.isError).toBe(true);
      expect(report!.message).toContain('ERROR');
      expect(report!.line).toBe(10);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'reports no error after a clean program',
    async () => {
      const m = new Vic20Machine({ roms });
      await m.whenReady();
      m.loadProgram(image('10 PRINT "HI"\n'));
      await m.whenReady();
      for (let i = 0; i < 300; i++) m.runFrame();
      expect(m.readReport()).toBeNull();
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'reports actual RAM figures spanning the unexpanded 3583 bytes',
    async () => {
      const m = new Vic20Machine({ roms });
      expect(m.readMemoryStats()).toBeNull(); // not booted yet
      await m.whenReady();
      for (let i = 0; i < 300; i++) m.runFrame();
      const stats = m.readMemoryStats();
      expect(stats).not.toBeNull();
      // Total spans TXTTAB ($1001) to MEMSIZ ($1E00): the banner's 3583 bytes,
      // almost all of them free at the READY prompt.
      expect(stats!.used + stats!.free).toBe(3583);
      expect(stats!.free).toBeGreaterThan(3500);
      m.dispose();
      expect(m.readMemoryStats()).toBeNull();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'types characters through the key matrix into the running KERNAL',
    async () => {
      // A key press must reach the KERNAL as the *right* character: the on-screen
      // keyboard and the controller both drive setKey, so a wrong matrix wiring
      // (e.g. the C64's) would echo the wrong glyph or nothing at all. Type "HI"
      // at the READY prompt and expect it to appear on screen. Neither letter is
      // in the boot banner, so a match can only come from the key scan.
      const m = new Vic20Machine({ roms });
      await m.whenReady();
      for (let i = 0; i < 300; i++) m.runFrame();
      const type = (token: string) => {
        m.setKey(token, true);
        for (let i = 0; i < 12; i++) m.runFrame(); // hold across a jiffy scan
        m.setKey(token, false);
        for (let i = 0; i < 12; i++) m.runFrame(); // let the editor echo it
      };
      // The W/A/S/D movement keys the bundled games (and the controller
      // bindings) rely on must each land as themselves.
      for (const t of ['W', 'A', 'S', 'D', 'H', 'I']) type(t);
      expect(contains(screen(m), screenCodes('WASDHI'))).toBe(true);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'plays the bundled maze sample: player starts on an open cell and moves',
    async () => {
      // Guards the whole input chain end to end through a real game: the maze
      // reads W/A/S/D with GET and moves a player it POKEs at SC-relative (row 0)
      // coordinates, so it only works if (a) the key matrix decodes those letters
      // and (b) the printed maze lines up with row 0 (no stray newline after the
      // clear-home). The player glyph is screen code 81, walls are 35.
      const src = readFileSync(
        join(__dirname, '../../dialects/vic20/samples/maze.bas'),
        'utf8',
      );
      const m = new Vic20Machine({ roms });
      await m.whenReady();
      m.loadProgram(image(src));
      await m.whenReady();
      for (let i = 0; i < 200; i++) m.runFrame();
      expect(m.readReport()).toBeNull(); // ran without a BASIC error
      const at = (x: number, y: number) =>
        m.peek(SCREEN_BASE + 22 * y + x) & 0x7f;
      expect(at(1, 1)).toBe(81); // player drawn on the open start cell...
      expect(at(0, 0)).toBe(35); // ...with the maze border aligned to row 0
      // Press D; the corridor is open to the right, so the player advances there.
      m.setKey('D', true);
      for (let i = 0; i < 10; i++) m.runFrame();
      m.setKey('D', false);
      for (let i = 0; i < 40; i++) m.runFrame();
      expect(at(2, 1)).toBe(81);
      expect(at(1, 1)).toBe(32); // start cell vacated
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  describe('step-through debugging', () => {
    // A tight loop whose executing line cycles 20 → 30 → 20, so a breakpoint on
    // 20 trips almost as soon as the program is running.
    const LOOP_SRC = '10 FOR I=1 TO 1000\n20 A=I\n30 NEXT I\n';

    async function loadLoop(): Promise<Vic20Machine> {
      const m = new Vic20Machine({ roms });
      await m.whenReady();
      m.loadProgram(image(LOOP_SRC));
      await m.whenReady();
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
      m: Vic20Machine,
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

  it(
    'synthesizes VIC-I audio while a voice sounds, and settles silent again',
    async () => {
      const m = new Vic20Machine({ roms });
      expect(m.audioSampleRate).toBe(44100);
      await m.whenReady();
      // Volume up, soprano voice on, then hold so the tone persists.
      m.loadProgram(image('10 POKE 36878,15\n20 POKE 36876,200\n30 GOTO 30\n'));
      await m.whenReady();
      for (let i = 0; i < 300; i++) m.runFrame();
      const out = m.readAudio();
      expect(out.length).toBe(882); // one 44.1kHz frame at 50Hz
      expect(Math.max(...out.map(Math.abs))).toBeGreaterThan(0.05);

      // Turn the voice and volume back off; the stream drains to empty.
      m.loadProgram(image('10 POKE 36878,0\n20 POKE 36876,0\n30 GOTO 30\n'));
      await m.whenReady();
      for (let i = 0; i < 300; i++) m.runFrame();
      let silent = m.readAudio();
      for (let f = 0; f < 6 && silent.length > 0; f++) silent = m.readAudio();
      expect(silent.length).toBe(0);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  describe('memory-activity recording', () => {
    it(
      'records CPU reads and writes, including the I/O region, while enabled',
      async () => {
        const m = new Vic20Machine({ roms });
        // Off by default: nothing to drain until recording is armed.
        expect(m.drainMemoryActivity()).toBeNull();
        await m.whenReady();
        m.setMemoryActivityRecording(true);
        // POKE the VIC-I border/screen register ($900F = 36879), then loop so
        // the write is made while we are sampling.
        m.loadProgram(image('10 POKE 36879,8\n20 GOTO 20\n'));
        await m.whenReady();
        for (let i = 0; i < 300; i++) m.runFrame();
        const hits = m.drainMemoryActivity();
        expect(hits).not.toBeNull();
        expect(hits!.length).toBe(0x10000);
        // The POKE 36879 write landed in the VIC-I I/O region.
        expect(hits![0x900f]! & WRITE_BIT).toBe(WRITE_BIT);
        // The running interpreter reads memory constantly.
        expect(hits!.some((b) => (b & READ_BIT) !== 0)).toBe(true);
        m.dispose();
      },
      BOOT_TIMEOUT_MS,
    );

    it(
      'stops recording and drains null once disabled',
      async () => {
        const m = new Vic20Machine({ roms });
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
});
