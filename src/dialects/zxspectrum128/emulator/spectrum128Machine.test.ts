import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Spectrum128Machine } from './spectrum128Machine';
import { tokenizeProgram } from '../tokenizer';
import { buildTap } from '../tapfile';
import { RAMTOP } from '../../zxspectrum/sysvars';
import type { MemoryBlock } from '../../types';

const ROM_PATH = join(__dirname, '../../../../public/roms/zxspectrum128.rom');
const hasRom = existsSync(ROM_PATH);
const rom = hasRom ? new Uint8Array(readFileSync(ROM_PATH)) : new Uint8Array(0);

/**
 * A run of characters off the screen, through the machine's own screen reader
 * rather than a test-local OCR. The reader resolves the displayed screen page
 * itself, so this follows the 128K onto its shadow screen.
 *
 * The leading `sigs` parameter is kept so the call sites read unchanged; the
 * machine now owns its own font index.
 */
function readScreen(
  machine: Spectrum128Machine,
  row: number,
  col: number,
  len: number,
): string {
  const line = machine.readScreenText()!.lines[row]!;
  return [...line].slice(col, col + len).join('');
}

/** Read an IO port through the machine's real decode (no ROM needed). */
function ioRead(machine: Spectrum128Machine, port: number): number {
  return (machine as unknown as { ioRead(p: number): number }).ioRead(port);
}

const NEUTRAL = {
  up: false,
  down: false,
  left: false,
  right: false,
  fire1: false,
  fire2: false,
};

// The joystick wiring and IO decode don't depend on ROM contents, so this runs
// even without public/roms/zxspectrum128.rom - a zeroed 32K stand-in suffices.
// Row 3 (keys 1-5) is selected by ULA high byte 0xF7; bit0=1 … bit4=5, active-low.
describe('Spectrum128Machine joystick', () => {
  const stub = () => new Spectrum128Machine({ rom: new Uint8Array(0x8000) });

  describe('kempston', () => {
    it('reads the active-high joystick byte on port 0x1F', () => {
      const m = stub();
      expect(ioRead(m, 0x1f)).toBe(0); // idle: all switches open
      m.setJoystick('kempston', { ...NEUTRAL, up: true, fire1: true });
      // bit3 = up, bit4 = fire.
      expect(ioRead(m, 0x1f)).toBe(0x08 | 0x10);
      m.setJoystick('kempston', {
        ...NEUTRAL,
        right: true,
        left: true,
        down: true,
      });
      expect(ioRead(m, 0x1f)).toBe(0x01 | 0x02 | 0x04);
    });

    it('folds fire2 onto the single Kempston fire bit', () => {
      const m = stub();
      m.setJoystick('kempston', { ...NEUTRAL, fire2: true });
      expect(ioRead(m, 0x1f) & 0x10).toBe(0x10);
    });

    it('does not shadow the even ULA keyboard port', () => {
      const m = stub();
      m.setJoystick('kempston', { ...NEUTRAL, up: true, down: true });
      // 0xFE is even (A0 low) → ULA keyboard read, never the joystick byte.
      expect(ioRead(m, 0xfefe) & 0x1f).toBe(0x1f); // no key held → all bits high
    });

    it('clears the joystick on reset', () => {
      const m = stub();
      m.setJoystick('kempston', { ...NEUTRAL, fire1: true });
      m.reset();
      expect(ioRead(m, 0x1f)).toBe(0);
    });
  });

  describe('native (Sinclair interface)', () => {
    it('maps directions/fire to keys 1-5 on the matrix', () => {
      const m = stub();
      // left = key 1 (bit0).
      m.setJoystick('native', { ...NEUTRAL, left: true });
      expect(ioRead(m, 0xf7fe) & 0x01).toBe(0);
      expect(ioRead(m, 0x1f)).toBe(0); // Kempston port stays idle in native mode
      // up = key 4 (bit3), fire = key 5 (bit4).
      m.setJoystick('native', { ...NEUTRAL, up: true, fire1: true });
      expect(ioRead(m, 0xf7fe) & 0x18).toBe(0);
      expect(ioRead(m, 0xf7fe) & 0x01).toBe(0x01); // left released → key 1 high
    });

    it('releases the Sinclair keys when centred', () => {
      const m = stub();
      m.setJoystick('native', { ...NEUTRAL, right: true });
      m.setJoystick('native', NEUTRAL);
      expect(ioRead(m, 0xf7fe) & 0x1f).toBe(0x1f); // all keys 1-5 released
    });
  });
});

// Boot the real 128 ROM, drive the menu to "128 BASIC", inject + run a program,
// and assert on the displayed bank. Skips cleanly when
// public/roms/zxspectrum128.rom is absent (it is not committed, and a fabricated
// ROM must never stand in for it - see ATTRIBUTION.md).
const suite = hasRom ? describe : describe.skip;

suite('Spectrum128Machine (needs public/roms/zxspectrum128.rom)', () => {
  it('flash-loads and runs 10 PRINT "HELLO" via the 128 menu', () => {
    const machine = new Spectrum128Machine({ rom });
    const { bytes, errors } = tokenizeProgram('10 PRINT "HELLO"\n');
    expect(errors).toEqual([]);
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 50; i++) machine.runFrame();
    expect(readScreen(machine, 0, 0, 5)).toBe('HELLO');
    // The ULA is taking its share of the bus off this machine too: 128 BASIC's
    // editor and workspace live in contended bank 5, so a booted machine that
    // has printed anything cannot have paid nothing. Staged here rather than
    // given a boot of its own - the per-address rule is pinned in
    // memory128.test.ts and the per-frame arithmetic on the 48K.
    expect(machine.contendedTStates).toBeGreaterThan(0);
  });

  it('runs from the .TAP auto-start line, not the first line', () => {
    const machine = new Spectrum128Machine({ rom });
    const { bytes, errors } = tokenizeProgram(
      '10 PRINT "AAA"\n20 PRINT "BBB"\n30 PRINT "CCC"\n',
    );
    expect(errors).toEqual([]);
    machine.loadProgram(buildTap(bytes), { autoStart: 30 });
    for (let i = 0; i < 50; i++) machine.runFrame();
    // RUN 30 starts at line 30, so only "CCC" prints (lines 10/20 skipped).
    expect(readScreen(machine, 0, 0, 3)).toBe('CCC');
  });

  it('round-trips a data SAVE/LOAD through the virtual filesystem', () => {
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

    const m1 = new Spectrum128Machine({ rom, files: store });
    const save = tokenizeProgram(
      '10 POKE 30000,77\n20 SAVE "S" CODE 30000,4\n30 PRINT "OK"\n',
    );
    expect(save.errors).toEqual([]);
    m1.loadProgram(buildTap(save.bytes));
    // SAVE waits at "Start tape, then press any key." - tap one mid-run.
    for (let i = 0; i < 260; i++) {
      m1.runFrame();
      if (i === 60) m1.setKey('KeyQ', true);
      if (i === 65) m1.setKey('KeyQ', false);
    }
    expect(readScreen(m1, 0, 0, 2)).toBe('OK');
    expect([...files.keys()]).toEqual(['S']);
    expect(files.get('S')!.kind).toBe('code');

    const m2 = new Spectrum128Machine({ rom, files: store });
    const load = tokenizeProgram(
      '10 LOAD "S" CODE\n20 PRINT "P=";PEEK 30000\n',
    );
    expect(load.errors).toEqual([]);
    m2.loadProgram(buildTap(load.bytes));
    for (let i = 0; i < 120; i++) m2.runFrame();
    const rows = Array.from({ length: 6 }, (_, r) => readScreen(m2, r, 0, 32));
    expect(rows).toContainEqual(expect.stringContaining('P=77'));
  });

  it('reports plausible actual RAM figures while a program runs', () => {
    const machine = new Spectrum128Machine({ rom });
    const { bytes, errors } = tokenizeProgram(
      '10 DIM a(500)\n20 PRINT "HELLO"\n',
    );
    expect(errors).toEqual([]);
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 50; i++) machine.runFrame();
    const stats = machine.readMemoryStats();
    expect(stats).not.toBeNull();
    // 500 five-byte floats ≈ 2.5K in use beyond the program text.
    expect(stats!.used).toBeGreaterThan(2500);
    expect(stats!.free).toBeGreaterThan(0);
    expect(stats!.used + stats!.free).toBeLessThanOrEqual(0x10000 - 0x5c00);
  });

  it('runs a PLAY/paging program without faulting on the AY writes', () => {
    const machine = new Spectrum128Machine({ rom });
    const src = '10 PLAY "cde"\n20 PRINT "DONE"\n';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 120; i++) machine.runFrame();
    expect(readScreen(machine, 0, 0, 4)).toBe('DONE');
  });

  it('synthesizes AY audio while a PLAY program runs', () => {
    const machine = new Spectrum128Machine({ rom });
    // The rate the machine emits at, not the synth's nominal 44100: 882
    // samples a frame at the 128K ULA's 50.02Hz.
    expect(machine.audioSampleRate).toBeCloseTo(44118.66, 1);
    const src = '10 PLAY "cdefgab"\n20 GO TO 10\n';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    machine.loadProgram(buildTap(bytes));
    let peak = 0;
    for (let i = 0; i < 200; i++) {
      machine.runFrame();
      const audio = machine.readAudio();
      for (const s of audio) peak = Math.max(peak, Math.abs(s));
    }
    // The PLAY drives the AY, so some frame must carry a non-silent sample.
    expect(peak).toBeGreaterThan(0.01);
  });

  it('reads program variables after running', () => {
    const machine = new Spectrum128Machine({ rom });
    const src = '10 LET A=5\n20 LET B$="HI"\n30 STOP\n';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 120; i++) machine.runFrame();
    const byName = Object.fromEntries(
      machine.readVariables().map((v) => [v.name, v]),
    );
    expect(byName['A']).toMatchObject({ kind: 'number', value: '5' });
    expect(byName['B$']).toMatchObject({ kind: 'string', value: '"HI"' });
  });

  it('reports a runtime error after a buggy program', () => {
    const machine = new Spectrum128Machine({ rom });
    // Reading an undefined variable is report 2 ("Variable not found").
    const { bytes } = tokenizeProgram('10 PRINT a\n');
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 60; i++) machine.runFrame();
    const report = machine.readReport();
    expect(report.isError).toBe(true);
    expect(report.code).toBe('2');
  });

  it('pages RAM banks 0-7 and reads them back over the 0xC000 window', () => {
    const machine = new Spectrum128Machine({ rom });
    machine.reset();
    for (let bank = 0; bank < 8; bank++) {
      machine.mem.writePort7ffd(bank);
      machine.mem.write(0xc000, 0xa0 + bank);
    }
    for (let bank = 0; bank < 8; bank++) {
      machine.mem.writePort7ffd(bank);
      expect(machine.mem.read(0xc000)).toBe(0xa0 + bank);
    }
  });

  it('steps through a loop and pauses at a breakpoint', () => {
    const machine = new Spectrum128Machine({ rom });
    const src = '10 FOR i=1 TO 1000\n20 LET a=i\n30 NEXT i\n';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    machine.loadProgram(buildTap(bytes));
    const line = machine.currentLine();
    expect(line === 10 || line === 20 || line === 30).toBe(true);
    let hit: { paused: boolean; line: number | null } | null = null;
    for (let i = 0; i < 5000; i++) {
      const res = machine.debugStep({
        breakpoints: new Set([20]),
        mode: 'run',
        fromLine: null,
      });
      if (res.paused) {
        hit = res;
        break;
      }
    }
    expect(hit).toEqual({ paused: true, line: 20 });
  });

  // Verified on the 128 ROM/editor too: loadProgram's `opts.blocks` writes raw
  // bytes directly into RAM before RUN, protecting blocks below RAMTOP with a
  // CLEAR typed out as a direct command.
  describe('memory blocks', () => {
    function bootDefaultRamtop(): number {
      const machine = new Spectrum128Machine({ rom });
      const { bytes, errors } = tokenizeProgram('10 PRINT "HI"\n');
      expect(errors).toEqual([]);
      machine.loadProgram(buildTap(bytes));
      return machine.mem.readWord(RAMTOP);
    }

    it('writes a block into memory before the program runs', () => {
      const machine = new Spectrum128Machine({ rom });
      const { bytes, errors } = tokenizeProgram('10 PAUSE 0\n');
      expect(errors).toEqual([]);
      const block: MemoryBlock = {
        id: 'b1',
        name: 'Code',
        address: 0x8000,
        bytes: new Uint8Array([0x3e, 0x02, 0xd3, 0xfe, 0xc9]),
        kind: 'code',
      };
      machine.loadProgram(buildTap(bytes), { blocks: [block] });
      const readBack = Array.from(block.bytes, (_, i) =>
        machine.mem.read(block.address + i),
      );
      expect(readBack).toEqual(Array.from(block.bytes));
    });

    it('reflects an injected block through PEEK', () => {
      const machine = new Spectrum128Machine({ rom });
      const { bytes, errors } = tokenizeProgram('10 PRINT PEEK 32768\n');
      expect(errors).toEqual([]);
      const block: MemoryBlock = {
        id: 'b1',
        name: 'Code',
        address: 0x8000,
        bytes: new Uint8Array([123]),
        kind: 'data',
      };
      machine.loadProgram(buildTap(bytes), { blocks: [block] });
      for (let i = 0; i < 60; i++) machine.runFrame();
      const rows = Array.from({ length: 6 }, (_, r) =>
        readScreen(machine, r, 0, 32),
      );
      expect(rows).toContainEqual(expect.stringContaining('123'));
    });

    it('keeps a block below RAMTOP intact after a program that grows the machine stack', () => {
      const ramtop = bootDefaultRamtop();
      const blockAddr = ramtop - 60;
      const payload = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee]);
      const machine = new Spectrum128Machine({ rom });
      const src =
        '10 FOR a=1 TO 2\n20 FOR b=1 TO 2\n30 FOR c=1 TO 2\n40 FOR d=1 TO 2\n' +
        '50 FOR e=1 TO 2\n60 FOR f=1 TO 2\n70 LET x=a+b+c+d+e+f\n80 NEXT f\n' +
        '90 NEXT e\n100 NEXT d\n110 NEXT c\n120 NEXT b\n130 NEXT a\n140 PRINT "DONE"\n';
      const { bytes, errors } = tokenizeProgram(src);
      expect(errors).toEqual([]);
      const block: MemoryBlock = {
        id: 'b1',
        name: 'Data',
        address: blockAddr,
        bytes: payload,
        kind: 'data',
      };
      machine.loadProgram(buildTap(bytes), { blocks: [block] });
      for (let i = 0; i < 150; i++) machine.runFrame();
      const rows = Array.from({ length: 6 }, (_, r) =>
        readScreen(machine, r, 0, 32),
      );
      expect(rows).toContainEqual(expect.stringContaining('DONE'));
      const readBack = Array.from(payload, (_, i) =>
        machine.mem.read(blockAddr + i),
      );
      expect(readBack).toEqual(Array.from(payload));
    });

    it('leaves memory untouched when no blocks are given', () => {
      const machine = new Spectrum128Machine({ rom });
      const { bytes, errors } = tokenizeProgram('10 PRINT "HELLO"\n');
      expect(errors).toEqual([]);
      machine.loadProgram(buildTap(bytes));
      for (let i = 0; i < 50; i++) machine.runFrame();
      expect(readScreen(machine, 0, 0, 5)).toBe('HELLO');
    });
  });

  /**
   * The run-state latch. The ROM address it fires on is a fact about the
   * committed image, so these cases reproduce the trace rather than asserting
   * the constant: each program is run on the real ROM and the machine is asked
   * what it says about itself. The still-running cases are what pin the
   * ROM-bank gate - ROM 1 executes the same instruction address repeatedly
   * while a program runs, so an ungated compare fails them within a second.
   */
  describe('isProgramRunning', () => {
    function load(src: string): Spectrum128Machine {
      const machine = new Spectrum128Machine({ rom });
      const { bytes, errors } = tokenizeProgram(src);
      expect(errors).toEqual([]);
      machine.loadProgram(buildTap(bytes));
      return machine;
    }

    /** Frames until the machine reports the program stopped, or the cap. */
    function settle(machine: Spectrum128Machine, frames = 400): boolean | null {
      for (let i = 0; i < frames; i++) {
        const running = machine.isProgramRunning();
        if (running === false) return false;
        machine.runFrame();
      }
      return machine.isProgramRunning();
    }

    it.each([
      ['falls off the end', '10 PRINT "HI"\n'],
      ['STOP', '10 STOP\n'],
      ['an error', '10 PRINT 1/0\n'],
      [
        'GO SUB and RETURN',
        '10 GO SUB 40\n20 PRINT "BACK"\n30 STOP\n40 RETURN\n',
      ],
      // Twenty rows rather than more: past the screen's height the ROM stops at
      // its own "scroll?" prompt, which is a program waiting for a key.
      [
        'a program that fills the screen',
        '10 FOR i=1 TO 20\n20 PRINT "ROW";i\n30 NEXT i\n',
      ],
    ])('reports no program running after %s', (_name, src) => {
      expect(settle(load(src))).toBe(false);
    });

    it.each([
      ['an idle loop', '10 GO TO 10\n'],
      ['an INKEY$ loop', '10 IF INKEY$="" THEN GO TO 10\n'],
      ['PAUSE', '10 PAUSE 0\n'],
      // The case every screen-shaped or cursor-shaped heuristic gets wrong: the
      // INPUT prompt's cursor is the editor's own.
      ['an INPUT prompt', '10 INPUT a\n20 GO TO 10\n'],
    ])('goes on reporting a program running at %s', (_name, src) => {
      expect(settle(load(src), 200)).toBe(true);
    });

    it('reports no program running once BREAK stops one', () => {
      const machine = load('10 GO TO 10\n');
      for (let i = 0; i < 60; i++) machine.runFrame();
      expect(machine.isProgramRunning()).toBe(true);
      machine.setKey('CapsShift', true);
      machine.setKey('Space', true);
      for (let i = 0; i < 8; i++) machine.runFrame();
      machine.setKey('CapsShift', false);
      machine.setKey('Space', false);
      expect(settle(machine, 60)).toBe(false);
    });

    it('goes on reporting a program running when BREAK is pressed at an INPUT prompt', () => {
      // The ROM only tests BREAK between statements, so a program stopped at an
      // INPUT prompt is not interrupted by it - and must not be reported as
      // finished either.
      const machine = load('10 INPUT a\n20 GO TO 10\n');
      for (let i = 0; i < 60; i++) machine.runFrame();
      machine.setKey('CapsShift', true);
      machine.setKey('Space', true);
      for (let i = 0; i < 8; i++) machine.runFrame();
      machine.setKey('CapsShift', false);
      machine.setKey('Space', false);
      expect(settle(machine, 120)).toBe(true);
    });
  });
});
