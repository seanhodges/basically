import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { C64Machine, type C64Roms } from './c64Machine';
import { READ_BIT, WRITE_BIT } from '../memoryActivityBuffer';
import { commodore64 } from '../../dialects/commodore64';

const ROOT = join(__dirname, '../../../public/roms/c64');
const roms: C64Roms = {
  basic: readFileSync(join(ROOT, 'basic.bin')),
  kernal: readFileSync(join(ROOT, 'kernal.bin')),
  character: readFileSync(join(ROOT, 'chargen.bin')),
};

/**
 * Booting the real C64 ROMs and running a few hundred frames is the slowest
 * thing in this suite: 4-10s per test with the whole suite running in
 * parallel, and the heaviest disk-I/O case close to 10s. That is well past
 * vitest's 5s default and near enough the 30s floor in `vite.config.ts` to be
 * worth saying out loud, so these keep an explicit budget of their own. The
 * boot dominates every case, so it's applied uniformly.
 */
const BOOT_TIMEOUT_MS = 30_000;

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
    'reads the booted screen back as text',
    async () => {
      const m = new C64Machine({ roms });
      expect(m.readScreenText()).toBeNull(); // not booted: no answer, not blank
      await m.whenReady();
      for (let i = 0; i < 200; i++) m.runFrame();
      const s = m.readScreenText()!;
      expect(s.cols).toBe(40);
      expect(s.rows).toBe(25);
      for (const line of s.lines) expect([...line]).toHaveLength(40);
      expect(s.lines.join('\n')).toContain('READY.');
      m.dispose();
      expect(m.readScreenText()).toBeNull();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'follows the screen when the program moves it',
    async () => {
      // The matrix address is not a constant on this machine: $D018 bits 4-7
      // pick a 1K slot inside CIA 2's 16K bank. Move the screen to $0C00 (slot
      // 3) the way a program would and the reader must follow it there. This is
      // what pins the derivation - a hard-coded $0400 fails here.
      const { image, errors } = commodore64.tokenize(
        '10 POKE 3072,8:POKE 3073,9:POKE 3074,32:POKE 3075,20\n' +
          '20 POKE 53272,(PEEK(53272)AND15)OR48\n' +
          '30 GOTO 30\n',
      );
      expect(errors).toEqual([]);
      const m = new C64Machine({ roms });
      await m.whenReady();
      m.loadProgram(image);
      await new Promise((r) => setTimeout(r, 0));
      for (let i = 0; i < 400; i++) m.runFrame();
      // Screen codes 8, 9, 32, 20 spell "HI T" in the graphics set.
      expect(m.readScreenText()!.lines[0]!.startsWith('HI T')).toBe(true);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'reads back what a program printed',
    async () => {
      const { image, errors } = commodore64.tokenize('10 PRINT "HELLO"\n');
      expect(errors).toEqual([]);
      const m = new C64Machine({ roms });
      await m.whenReady();
      m.loadProgram(image);
      await new Promise((r) => setTimeout(r, 0));
      for (let i = 0; i < 300; i++) m.runFrame();
      expect(m.readScreenText()!.lines.join('\n')).toContain('HELLO');
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'reports plausible actual RAM figures while a program runs',
    async () => {
      const { image, errors } = commodore64.tokenize(
        '10 DIM A(500)\n20 PRINT "HELLO"\n',
      );
      expect(errors).toEqual([]);
      const m = new C64Machine({ roms });
      expect(m.readMemoryStats()).toBeNull(); // not booted yet
      await m.whenReady();
      m.loadProgram(image);
      await new Promise((r) => setTimeout(r, 0));
      for (let i = 0; i < 300; i++) m.runFrame();
      const stats = m.readMemoryStats();
      expect(stats).not.toBeNull();
      // 500 five-byte floats ≈ 2.5K in use beyond the program text.
      expect(stats!.used).toBeGreaterThan(2500);
      expect(stats!.free).toBeGreaterThan(0);
      // Total spans TXTTAB ($0801) to MEMSIZ ($A000): the documented 38911.
      expect(stats!.used + stats!.free).toBe(38911);
      m.dispose();
      expect(m.readMemoryStats()).toBeNull();
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

  describe('memory-activity recording', () => {
    it(
      'records CPU reads and writes, including the I/O region, while enabled',
      async () => {
        // A single POKE into VIC I/O ($D020, the border) - the accumulated hits
        // buffer keeps that write until the drain, proving the wrapped bus
        // captures I/O-region access, not just raw RAM.
        const { image, errors } = commodore64.tokenize('10 POKE 53280,0\n');
        expect(errors).toEqual([]);
        const m = new C64Machine({ roms });
        // Off by default: nothing to drain until recording is armed.
        expect(m.drainMemoryActivity()).toBeNull();
        await m.whenReady();
        m.setMemoryActivityRecording(true);
        m.loadProgram(image);
        await new Promise((r) => setTimeout(r, 0));
        for (let i = 0; i < 300; i++) m.runFrame();
        const hits = m.drainMemoryActivity();
        expect(hits).not.toBeNull();
        expect(hits!.length).toBe(0x10000);
        // The POKE 53280 write landed in the VIC I/O region.
        expect(hits![0xd020] & WRITE_BIT).toBe(WRITE_BIT);
        // The running interpreter reads memory constantly.
        expect(hits!.some((b) => (b & READ_BIT) !== 0)).toBe(true);
        m.dispose();
      },
      BOOT_TIMEOUT_MS,
    );

    it(
      'drains nothing once recording is turned off',
      async () => {
        const m = new C64Machine({ roms });
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

  // Whether a program is running - reported while it runs, not before it starts,
  // and no longer once it has ended - is checked over the whole registry, on
  // every machine, by src/dialects/programRunState.test.ts.
});

describe('C64Machine disk I/O over the VFS', () => {
  /** Map-backed MachineFileStore, same shape as diskDrive.test.ts. */
  function fakeStore() {
    const files = new Map<string, { data: Uint8Array; kind?: string }>();
    const store = {
      save: (name: string, data: Uint8Array, meta?: { kind?: string }) =>
        void files.set(name, { data: data.slice(), kind: meta?.kind }),
      load: (name: string) => files.get(name)?.data.slice() ?? null,
      list: () =>
        [...files.entries()].map(([name, f]) => ({
          name,
          size: f.data.length,
          updatedAt: 1,
          kind: f.kind,
        })),
      delete: (name: string) => files.delete(name),
    };
    return { store, files };
  }

  /** A stored file's contents as PETSCII-as-ASCII text. */
  function text(
    files: Map<string, { data: Uint8Array }>,
    name: string,
  ): string {
    const f = files.get(name);
    return f ? String.fromCharCode(...f.data) : '';
  }

  /** Tokenize, load and run a program to READY against the given store. */
  async function run(store: unknown, src: string, frames = 400) {
    const { image, errors } = commodore64.tokenize(src);
    expect(errors).toEqual([]);
    const m = new C64Machine({ roms, files: store as never });
    await m.whenReady();
    m.loadProgram(image);
    await new Promise((r) => setTimeout(r, 0));
    for (let i = 0; i < frames; i++) m.runFrame();
    return m;
  }

  it(
    'writes a data file with OPEN/PRINT#/CLOSE on device 8',
    async () => {
      const { store, files } = fakeStore();
      const m = await run(
        store,
        '10 OPEN 2,8,2,"DATA,S,W"\n' +
          '20 PRINT#2,"HELLO"\n' +
          '30 PRINT#2,42\n' +
          '40 CLOSE 2\n' +
          '50 PRINT "DONE"\n',
      );
      expect(contains(screen(m), screenCodes('DONE'))).toBe(true);
      expect([...files.keys()]).toEqual(['DATA']);
      expect(files.get('DATA')!.kind).toBe('data');
      // PRINT# terminates each item with a carriage return ($0d).
      expect(text(files, 'DATA')).toContain('HELLO');
      expect(text(files, 'DATA')).toContain('42');
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'reads a data file back with INPUT# (string then number)',
    async () => {
      const { store } = fakeStore();
      // First machine writes the file...
      const writer = await run(
        store,
        '10 OPEN 2,8,2,"REC,S,W"\n' +
          '20 PRINT#2,"HELLO"\n' +
          '30 PRINT#2,42\n' +
          '40 CLOSE 2\n',
      );
      writer.dispose();

      // ...a second machine, sharing the store, reads it back.
      const reader = await run(
        store,
        '10 OPEN 2,8,2,"REC,S,R"\n' +
          '20 INPUT#2,A$\n' +
          '30 INPUT#2,B\n' +
          '40 CLOSE 2\n',
      );
      const byName = new Map(reader.readVariables().map((v) => [v.name, v]));
      expect(byName.get('A$')).toMatchObject({
        kind: 'string',
        value: '"HELLO"',
      });
      expect(byName.get('B')).toMatchObject({ kind: 'number', value: '42' });
      reader.dispose();
    },
    BOOT_TIMEOUT_MS,
  );

  it(
    'leaves the store untouched for ordinary screen output',
    async () => {
      const { store, files } = fakeStore();
      const m = await run(store, '10 PRINT "NO FILES HERE"\n');
      expect(contains(screen(m), screenCodes('NO FILES HERE'))).toBe(true);
      expect(files.size).toBe(0);
      m.dispose();
    },
    BOOT_TIMEOUT_MS,
  );
});
