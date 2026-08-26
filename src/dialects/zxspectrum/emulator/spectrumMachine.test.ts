import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SpectrumMachine } from './spectrumMachine';
import { tokenizeProgram } from '../tokenizer';
import { buildTap, codeTap } from '../tapfile';
import { RAMTOP } from '../sysvars';
import type { MemoryBlock } from '../../types';

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../../public/roms/zxspectrum.rom')),
);

/**
 * A run of characters off the screen, through the machine's own screen reader
 * rather than a test-local OCR of the display file.
 */
function readScreen(
  machine: SpectrumMachine,
  row: number,
  col: number,
  len: number,
): string {
  const line = machine.readScreenText()!.lines[row]!;
  return [...line].slice(col, col + len).join('');
}

describe('SpectrumMachine', () => {
  it('boots the ROM to the copyright prompt', () => {
    const machine = new SpectrumMachine({ rom });
    machine.reset();
    machine.bootToReady();
    // The bottom line shows "© 1982 Sinclair Research Ltd".
    const line = readScreen(machine, 23, 0, 28);
    expect(line).toContain('1982 Sinclair');
  });

  it('flash-loads and runs 10 PRINT "HELLO"', () => {
    const machine = new SpectrumMachine({ rom });
    const { bytes, errors } = tokenizeProgram('10 PRINT "HELLO"\n');
    expect(errors).toEqual([]);
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 50; i++) machine.runFrame();
    expect(readScreen(machine, 0, 0, 5)).toBe('HELLO');
  });

  it('renders mid-frame attribute changes per scanline (multicolour / rainbow)', () => {
    // A machine-code loop that hammers the top-left attribute cell (0x5800)
    // with an ever-changing value while the frame is drawn. With scanline-
    // accurate rendering the eight pixel rows of that one character cell sample
    // different attribute values, so they show more than one colour - the
    // effect a whole-frame snapshot (single colour per cell) cannot reproduce.
    const machine = new SpectrumMachine({ rom });
    const { bytes, errors } = tokenizeProgram('10 RANDOMIZE USR 32768\n');
    expect(errors).toEqual([]);
    const raster: MemoryBlock = {
      id: 'raster',
      name: 'Raster',
      address: 0x8000,
      // LD HL,0x5800 / LD A,0 / (loop) LD (HL),A / INC A / JR loop
      bytes: new Uint8Array([
        0x21, 0x00, 0x58, 0x3e, 0x00, 0x77, 0x3c, 0x18, 0xfc,
      ]),
      kind: 'code',
    };
    machine.loadProgram(buildTap(bytes), { blocks: [raster] });
    for (let i = 0; i < 5; i++) machine.runFrame();

    const frame = machine.frame;
    const colours = new Set<string>();
    for (let y = 0; y < 8; y++) {
      const p = (y * 256 + 0) * 4;
      colours.add(`${frame[p]},${frame[p + 1]},${frame[p + 2]}`);
    }
    expect(colours.size).toBeGreaterThan(1);
  });

  it('holds the frame interrupt open past the frame boundary', () => {
    // `DI`, then forever `EI` / `DI` / `JR` - a 20 T-state loop in which
    // interrupts are enabled at exactly one instruction boundary, the one after
    // the DI (the Z80 applies an EI at the end of the *following* instruction).
    // The frame boundary lands inside that window about two frames in five, so
    // a /INT offered for one instant is taken about that often. The ULA holds
    // it low for 32 T-states, which always covers a whole pass of the loop, so
    // every frame's interrupt is taken - and the ROM's FRAMES counter, which
    // its handler bumps, says which of the two is happening.
    const FRAMES = 0x5c78; // ROM frame counter, three bytes little-endian
    const machine = new SpectrumMachine({ rom });
    const { bytes, errors } = tokenizeProgram('10 RANDOMIZE USR 32768\n');
    expect(errors).toEqual([]);
    const flicker: MemoryBlock = {
      id: 'flicker',
      name: 'Flicker',
      address: 0x8000,
      bytes: new Uint8Array([0xf3, 0xfb, 0xf3, 0x18, 0xfc]),
      kind: 'code',
    };
    machine.loadProgram(buildTap(bytes), { blocks: [flicker] });
    const counter = () =>
      machine.mem.peek(FRAMES) |
      (machine.mem.peek(FRAMES + 1) << 8) |
      (machine.mem.peek(FRAMES + 2) << 16);
    for (let i = 0; i < 60; i++) machine.runFrame(); // reach the loop
    const before = counter();
    for (let i = 0; i < 200; i++) machine.runFrame();
    expect(counter() - before).toBe(200);
  });

  it('reports plausible actual RAM figures while a program runs', () => {
    const machine = new SpectrumMachine({ rom });
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
    // PROG sits above 0x5C00 and RAMTOP within the 64K map.
    expect(stats!.used + stats!.free).toBeLessThanOrEqual(0x10000 - 0x5c00);
  });

  it('runs a FOR loop printing multiple rows', () => {
    const machine = new SpectrumMachine({ rom });
    const src = '10 FOR i=1 TO 3\n20 PRINT "ROW";i\n30 NEXT i\n';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 80; i++) machine.runFrame();
    expect(readScreen(machine, 0, 0, 4)).toBe('ROW1');
    expect(readScreen(machine, 2, 0, 4)).toBe('ROW3');
  });

  it('reads program variables after running', () => {
    const machine = new SpectrumMachine({ rom });
    const src =
      '10 LET A=5\n20 LET B$="HI"\n30 DIM C(3)\n40 LET C(1)=7\n50 FOR I=1 TO 3\n60 STOP\n';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 120; i++) machine.runFrame();
    const vars = machine.readVariables();
    const byName = Object.fromEntries(vars.map((v) => [v.name, v]));
    expect(byName['A']).toMatchObject({ kind: 'number', value: '5' });
    expect(byName['B$']).toMatchObject({ kind: 'string', value: '"HI"' });
    expect(byName['C()']).toMatchObject({ kind: 'number-array' });
    expect(byName['C()']!.value).toContain('7');
    expect(byName['I']).toMatchObject({ kind: 'number' });
  });

  it('reports a runtime error after a buggy program', () => {
    const machine = new SpectrumMachine({ rom });
    // Reading an undefined variable is report 2 ("Variable not found").
    const { bytes, errors } = tokenizeProgram('10 PRINT a\n');
    expect(errors).toEqual([]);
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 60; i++) machine.runFrame();
    const report = machine.readReport();
    expect(report.isError).toBe(true);
    expect(report.code).toBe('2');
  });

  it('reports no error after a clean program', () => {
    const machine = new SpectrumMachine({ rom });
    const { bytes } = tokenizeProgram('10 PRINT "HELLO"\n');
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 60; i++) machine.runFrame();
    expect(machine.readReport().isError).toBe(false);
  });

  it('responds to emulated keypresses via INKEY$', () => {
    const machine = new SpectrumMachine({ rom });
    const src = '10 IF INKEY$="" THEN GO TO 10\n20 PRINT "KEY ";INKEY$\n';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 30; i++) machine.runFrame();
    machine.setKey('KeyQ', true);
    for (let i = 0; i < 30; i++) machine.runFrame();
    machine.setKey('KeyQ', false);
    for (let i = 0; i < 30; i++) machine.runFrame();
    expect(readScreen(machine, 0, 0, 5)).toBe('KEY q');
  });

  it('produces beeper audio while a BEEP statement runs', () => {
    const machine = new SpectrumMachine({ rom });
    const { bytes, errors } = tokenizeProgram('10 BEEP 0.3,0\n');
    expect(errors).toEqual([]);
    machine.loadProgram(buildTap(bytes));

    // Drain frames; BEEP toggles port 0xFE bit 4, so at least one frame's
    // readAudio() must carry a real square wave (swings both signs).
    let sawPositive = false;
    let sawNegative = false;
    let peak = 0;
    for (let i = 0; i < 40; i++) {
      machine.runFrame();
      for (const s of machine.readAudio()) {
        if (s > 0.01) sawPositive = true;
        if (s < -0.01) sawNegative = true;
        peak = Math.max(peak, Math.abs(s));
      }
    }
    expect(sawPositive).toBe(true);
    expect(sawNegative).toBe(true);
    expect(peak).toBeGreaterThan(0.1);
  });

  it('is silent (empty audio) at the idle prompt', () => {
    const machine = new SpectrumMachine({ rom });
    machine.reset();
    machine.bootToReady();
    // A few frames sitting at the prompt should synthesize nothing.
    let total = 0;
    for (let i = 0; i < 5; i++) {
      machine.runFrame();
      total += machine.readAudio().length;
    }
    expect(total).toBe(0);
  });

  describe('auto-start line', () => {
    const SRC = '10 PRINT "AAA"\n20 PRINT "BBB"\n30 PRINT "CCC"\n';

    it('runs from the .TAP auto-start line, not the first line', () => {
      const machine = new SpectrumMachine({ rom });
      const { bytes, errors } = tokenizeProgram(SRC);
      expect(errors).toEqual([]);
      machine.loadProgram(buildTap(bytes), { autoStart: 30 });
      for (let i = 0; i < 50; i++) machine.runFrame();
      // RUN 30 clears variables and starts at line 30, so only "CCC" prints -
      // lines 10 and 20 never ran.
      expect(readScreen(machine, 0, 0, 3)).toBe('CCC');
    });

    it('runs from the first line when no auto-start is given', () => {
      const machine = new SpectrumMachine({ rom });
      const { bytes, errors } = tokenizeProgram(SRC);
      expect(errors).toEqual([]);
      machine.loadProgram(buildTap(bytes));
      for (let i = 0; i < 50; i++) machine.runFrame();
      expect(readScreen(machine, 0, 0, 3)).toBe('AAA');
    });
  });

  describe('step-through debugging', () => {
    const LOOP_SRC = '10 FOR i=1 TO 1000\n20 LET a=i\n30 NEXT i\n';

    function load(): SpectrumMachine {
      const { bytes, errors } = tokenizeProgram(LOOP_SRC);
      expect(errors).toEqual([]);
      const machine = new SpectrumMachine({ rom });
      machine.loadProgram(buildTap(bytes));
      return machine;
    }

    function runToPause(
      machine: SpectrumMachine,
      mode: 'run' | 'step',
      breakpoints: Set<number>,
      fromLine: number | null,
    ) {
      for (let i = 0; i < 5000; i++) {
        const res = machine.debugStep({ breakpoints, mode, fromLine });
        if (res.paused) return res;
      }
      throw new Error('debugStep never paused');
    }

    it('reports a current line inside the running program', () => {
      const machine = load();
      const line = machine.currentLine();
      expect(line === 10 || line === 20 || line === 30).toBe(true);
    });

    it('pauses at a breakpointed line, then steps to the next', () => {
      const machine = load();
      const hit = runToPause(machine, 'run', new Set([20]), null);
      expect(hit).toEqual({ paused: true, line: 20 });
      const stepped = runToPause(machine, 'step', new Set(), 20);
      expect(stepped.paused).toBe(true);
      expect(stepped.line).toBe(30);
    });
  });

  describe('virtual filesystem tape traps', () => {
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

    /** The top few screen rows as text, for output that follows tape chatter. */
    function screenRows(machine: SpectrumMachine, rows = 6): string[] {
      return Array.from({ length: rows }, (_, r) =>
        readScreen(machine, r, 0, 32),
      );
    }

    function run(
      machine: SpectrumMachine,
      src: string,
      opts: { frames?: number; tapKeyAt?: number } = {},
    ): void {
      const { bytes, errors } = tokenizeProgram(src);
      expect(errors).toEqual([]);
      machine.loadProgram(buildTap(bytes));
      const frames = opts.frames ?? 100;
      for (let i = 0; i < frames; i++) {
        machine.runFrame();
        // SAVE waits at "Start tape, then press any key." - tap one.
        if (opts.tapKeyAt !== undefined && i === opts.tapKeyAt) {
          machine.setKey('KeyQ', true);
        }
        if (opts.tapKeyAt !== undefined && i === opts.tapKeyAt + 5) {
          machine.setKey('KeyQ', false);
        }
      }
    }

    it('captures SAVE ... DATA into the store and loads it back', () => {
      const { store, files } = fakeStore();
      const m1 = new SpectrumMachine({ rom, files: store });
      run(
        m1,
        '10 DIM a(3)\n20 FOR i=1 TO 3\n30 LET a(i)=i*i\n40 NEXT i\n50 SAVE "NUMS" DATA a()\n60 PRINT "SAVED"\n',
        { frames: 260, tapKeyAt: 60 },
      );
      expect(readScreen(m1, 0, 0, 5)).toBe('SAVED');
      expect([...files.keys()]).toEqual(['NUMS']);
      expect(files.get('NUMS')!.kind).toBe('data-num');

      const m2 = new SpectrumMachine({ rom, files: store });
      run(m2, '10 LOAD "NUMS" DATA b()\n20 PRINT "B=";b(2)\n', { frames: 120 });
      // The ROM prints "Number array: NUMS" chatter first, so scan the rows.
      expect(screenRows(m2)).toContainEqual(expect.stringContaining('B=4'));
    });

    it('captures SAVE ... CODE and loads the bytes back with LOAD ... CODE', () => {
      const { store, files } = fakeStore();
      const m1 = new SpectrumMachine({ rom, files: store });
      run(m1, '10 POKE 30000,123\n20 SAVE "S" CODE 30000,4\n30 PRINT "OK"\n', {
        frames: 260,
        tapKeyAt: 60,
      });
      expect(readScreen(m1, 0, 0, 2)).toBe('OK');
      expect([...files.keys()]).toEqual(['S']);
      expect(files.get('S')!.kind).toBe('code');

      const m2 = new SpectrumMachine({ rom, files: store });
      run(m2, '10 LOAD "S" CODE\n20 PRINT "P=";PEEK 30000\n', { frames: 120 });
      expect(screenRows(m2)).toContainEqual(expect.stringContaining('P=123'));
    });

    it('does not capture a BASIC program SAVE (data operations only)', () => {
      const { store, files } = fakeStore();
      const machine = new SpectrumMachine({ rom, files: store });
      // The real SA-BYTES runs against the (absent) tape; give it a while
      // and confirm nothing landed in the store.
      run(machine, '10 SAVE "P"\n', { frames: 200, tapKeyAt: 60 });
      expect(files.size).toBe(0);
    });

    it('raises "R Tape loading error" for a missing file name', () => {
      const { store } = fakeStore();
      const m1 = new SpectrumMachine({ rom, files: store });
      run(m1, '10 POKE 30000,1\n20 SAVE "X" CODE 30000,2\n', {
        frames: 260,
        tapKeyAt: 60,
      });

      const m2 = new SpectrumMachine({ rom, files: store });
      run(m2, '10 LOAD "WRONG" CODE\n20 PRINT "NEVER"\n', { frames: 150 });
      const report = m2.readReport();
      expect(report.isError).toBe(true);
      expect(report.code).toBe('R');
    });

    it('mounts a preserved tape file so the running program can LOAD it', () => {
      // A multi-part .TAP import preserves the loader/extra files as tapeFiles;
      // loadProgram mounts them on the deck so the edited program's own
      // LOAD "name" CODE finds them, as off the original tape.
      const { store } = fakeStore();
      const machine = new SpectrumMachine({ rom, files: store });
      const { bytes } = tokenizeProgram(
        '10 LOAD "X" CODE\n20 PRINT "P=";PEEK 30000\n',
      );
      machine.loadProgram(buildTap(bytes), {
        tapeFiles: [
          {
            name: 'X',
            kind: 'code',
            tap: codeTap('X', 30000, Uint8Array.from([99])),
          },
        ],
      });
      for (let i = 0; i < 150; i++) machine.runFrame();
      expect(screenRows(machine)).toContainEqual(
        expect.stringContaining('P=99'),
      );
    });

    it('keeps LOAD hanging (BREAK-able) while the store is empty', () => {
      const { store } = fakeStore();
      const machine = new SpectrumMachine({ rom, files: store });
      run(machine, '10 LOAD "ANY" CODE\n20 PRINT "NEVER"\n', { frames: 150 });
      // No files: the trap must not arm, so the ROM keeps polling the tape.
      expect(machine.readReport().isError).toBe(false);
      expect(readScreen(machine, 0, 0, 5)).not.toBe('NEVER');
    });
  });

  // The joystick wiring and IO decode don't depend on running the ROM, so these
  // probe the machine directly. Keys 1-5 live on matrix row selected by ULA high
  // byte 0xF7 (bit0=1 … bit4=5, active-low).
  describe('joystick', () => {
    const NEUTRAL = {
      up: false,
      down: false,
      left: false,
      right: false,
      fire1: false,
      fire2: false,
    };
    const ioRead = (m: SpectrumMachine, port: number): number =>
      (m as unknown as { ioRead(p: number): number }).ioRead(port);

    it('drives the Kempston port ($1F) active-high', () => {
      const m = new SpectrumMachine({ rom });
      expect(ioRead(m, 0x1f)).toBe(0); // idle
      m.setJoystick('kempston', { ...NEUTRAL, up: true, fire1: true });
      expect(ioRead(m, 0x1f)).toBe(0x08 | 0x10); // bit3 up, bit4 fire
      m.setJoystick('kempston', { ...NEUTRAL, fire2: true });
      expect(ioRead(m, 0x1f) & 0x10).toBe(0x10); // fire2 folds onto fire bit
      // Even ULA ports never read the Kempston byte.
      expect(ioRead(m, 0xfefe) & 0x1f).toBe(0x1f);
    });

    it('drives the Sinclair interface (native) via keys 1-5', () => {
      const m = new SpectrumMachine({ rom });
      // left = key 1 (bit0); Kempston stays idle in native mode.
      m.setJoystick('native', { ...NEUTRAL, left: true });
      expect(ioRead(m, 0xf7fe) & 0x01).toBe(0);
      expect(ioRead(m, 0x1f)).toBe(0);
      // up = key 4 (bit3), fire = key 5 (bit4).
      m.setJoystick('native', { ...NEUTRAL, up: true, fire1: true });
      expect(ioRead(m, 0xf7fe) & 0x18).toBe(0);
      expect(ioRead(m, 0xf7fe) & 0x01).toBe(0x01); // left released
      // Centring releases all five keys.
      m.setJoystick('native', NEUTRAL);
      expect(ioRead(m, 0xf7fe) & 0x1f).toBe(0x1f);
    });

    it('clears the Kempston byte on reset', () => {
      const m = new SpectrumMachine({ rom });
      m.setJoystick('kempston', { ...NEUTRAL, fire1: true });
      m.reset();
      expect(ioRead(m, 0x1f)).toBe(0);
    });
  });

  describe('memory-activity recording', () => {
    it('drains null until recording is enabled', () => {
      const m = new SpectrumMachine({ rom });
      expect(m.drainMemoryActivity()).toBeNull();
      m.setMemoryActivityRecording(true);
      const drained = m.drainMemoryActivity();
      expect(drained).not.toBeNull();
      expect(drained).toHaveLength(0x10000);
    });

    it('captures CPU accesses made while running a frame', () => {
      const m = new SpectrumMachine({ rom });
      m.setMemoryActivityRecording(true);
      m.runFrame();
      const drained = m.drainMemoryActivity()!;
      // The ROM interrupt handler touches plenty of addresses each frame.
      expect(drained.some((b) => b !== 0)).toBe(true);
    });

    it('recycles a passed-back buffer as the next fill target', () => {
      const m = new SpectrumMachine({ rom });
      m.setMemoryActivityRecording(true);
      const first = m.drainMemoryActivity()!;
      // Handing `first` back installs it (zeroed) as the live fill target.
      m.drainMemoryActivity(first);
      expect(m.mem.activity.hits).toBe(first); // reused, not reallocated
    });

    it('stops recording and clears hits when disabled', () => {
      const m = new SpectrumMachine({ rom });
      m.setMemoryActivityRecording(true);
      m.runFrame();
      m.setMemoryActivityRecording(false);
      // Disabled: drain returns null and the buffer was cleared.
      expect(m.drainMemoryActivity()).toBeNull();
      expect(m.mem.activity.hits.every((b) => b === 0)).toBe(true);
      // Running while disabled records nothing.
      m.runFrame();
      expect(m.mem.activity.hits.every((b) => b === 0)).toBe(true);
    });
  });

  // loadProgram's `opts.blocks` writes raw
  // bytes directly into RAM before RUN, and protects blocks below RAMTOP with
  // a CLEAR so the BASIC stack can't grow down over them.
  describe('memory blocks', () => {
    function block(overrides: Partial<MemoryBlock> = {}): MemoryBlock {
      return {
        id: 'b1',
        name: 'Code',
        address: 0x8000,
        bytes: new Uint8Array([0x3e, 0x02, 0xd3, 0xfe, 0xc9]),
        kind: 'code',
        ...overrides,
      };
    }

    /** RAMTOP as the ROM itself sets it at boot, read from its own sysvar. */
    function bootDefaultRamtop(): number {
      const machine = new SpectrumMachine({ rom });
      machine.reset();
      machine.bootToReady();
      return machine.mem.readWord(RAMTOP);
    }

    it('writes a block into memory before the program runs', () => {
      const machine = new SpectrumMachine({ rom });
      const { bytes, errors } = tokenizeProgram('10 PAUSE 0\n');
      expect(errors).toEqual([]);
      const b = block();
      machine.loadProgram(buildTap(bytes), { blocks: [b] });
      const readBack = Array.from(b.bytes, (_, i) =>
        machine.mem.read(b.address + i),
      );
      expect(readBack).toEqual(Array.from(b.bytes));
    });

    it('reflects an injected block through PEEK', () => {
      const machine = new SpectrumMachine({ rom });
      const { bytes, errors } = tokenizeProgram('10 PRINT PEEK 32768\n');
      expect(errors).toEqual([]);
      const b = block({ bytes: new Uint8Array([123]) });
      machine.loadProgram(buildTap(bytes), { blocks: [b] });
      for (let i = 0; i < 50; i++) machine.runFrame();
      expect(readScreen(machine, 0, 0, 3)).toBe('123');
    });

    it('keeps a block below RAMTOP intact after a program that grows the machine stack', () => {
      const ramtop = bootDefaultRamtop();
      // Comfortably below the default RAMTOP, so without protection the
      // downward-growing FOR-NEXT/GO SUB stack (which starts near RAMTOP)
      // would run straight into it.
      const blockAddr = ramtop - 60;
      const payload = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee]);
      const machine = new SpectrumMachine({ rom });
      // Six nested FOR loops: each active loop holds an ~18-byte control
      // record on that same stack, so this pushes the stack well past a
      // 60-byte gap while the innermost statement executes.
      const src =
        '10 FOR a=1 TO 2\n20 FOR b=1 TO 2\n30 FOR c=1 TO 2\n40 FOR d=1 TO 2\n' +
        '50 FOR e=1 TO 2\n60 FOR f=1 TO 2\n70 LET x=a+b+c+d+e+f\n80 NEXT f\n' +
        '90 NEXT e\n100 NEXT d\n110 NEXT c\n120 NEXT b\n130 NEXT a\n140 PRINT "DONE"\n';
      const { bytes, errors } = tokenizeProgram(src);
      expect(errors).toEqual([]);
      const b: MemoryBlock = {
        id: 'b1',
        name: 'Data',
        address: blockAddr,
        bytes: payload,
        kind: 'data',
      };
      machine.loadProgram(buildTap(bytes), { blocks: [b] });
      for (let i = 0; i < 100; i++) machine.runFrame();
      expect(readScreen(machine, 0, 0, 4)).toBe('DONE');
      const readBack = Array.from(payload, (_, i) =>
        machine.mem.read(blockAddr + i),
      );
      expect(readBack).toEqual(Array.from(payload));
    });

    it('leaves memory untouched when no blocks are given', () => {
      const machine = new SpectrumMachine({ rom });
      const { bytes, errors } = tokenizeProgram('10 PRINT "HELLO"\n');
      expect(errors).toEqual([]);
      machine.loadProgram(buildTap(bytes));
      for (let i = 0; i < 50; i++) machine.runFrame();
      expect(readScreen(machine, 0, 0, 5)).toBe('HELLO');
    });

    it("serves an imported CODE block to the program's own LOAD … CODE", () => {
      // A tape front-end that LOADs its own code (like the Sinclair Test
      // Program): the imported block must be on the VFS tape, not only injected.
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
      const machine = new SpectrumMachine({ rom, files: store });
      const b = block({
        name: 'z',
        address: 50000,
        bytes: new Uint8Array([123]),
      });
      // The program loads "z" to 51000 - a different address than the block's
      // own 50000 - so a hit at 51000 proves the bytes came off the tape deck,
      // not the direct pre-injection (which only touched 50000).
      const { bytes, errors } = tokenizeProgram(
        '10 LOAD "z"CODE 51000\n20 STOP\n',
      );
      expect(errors).toEqual([]);
      machine.loadProgram(buildTap(bytes), { blocks: [b] });
      for (let i = 0; i < 150; i++) machine.runFrame();
      expect(machine.mem.read(51000)).toBe(123);
      expect(machine.readReport().isError).toBe(false);
    });
  });

  /**
   * The run-state latch. The ROM address it fires on is a fact about the
   * committed image, so these cases reproduce the trace rather than asserting
   * the constant: each program is run on the real ROM and the machine is asked
   * what it says about itself.
   */
  describe('isProgramRunning', () => {
    function load(
      src: string,
      opts?: { blocks?: MemoryBlock[] },
    ): SpectrumMachine {
      const machine = new SpectrumMachine({ rom });
      const { bytes, errors } = tokenizeProgram(src);
      expect(errors).toEqual([]);
      machine.loadProgram(buildTap(bytes), opts);
      return machine;
    }

    /** Frames until the machine reports the program stopped, or the cap. */
    function settle(machine: SpectrumMachine, frames = 400): boolean | null {
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
      // its own "scroll?" prompt, which is a program waiting for a key and is
      // covered as such below.
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

    it('latches past the extra CLEAR a block below RAMTOP costs', () => {
      // A document with a low memory block makes loadProgram type a CLEAR as
      // well as its LOAD, so the ROM passes the latch address one more time
      // before RUN. Counting hits would report this program finished before it
      // started; arming after the last of those command lines does not.
      const machine = new SpectrumMachine({ rom });
      machine.reset();
      machine.bootToReady();
      const ramtop = machine.mem.readWord(RAMTOP);
      const looping = load('10 GO TO 10\n', {
        blocks: [
          {
            id: 'b1',
            name: 'Code',
            address: ramtop - 60,
            bytes: new Uint8Array([0xaa, 0xbb]),
            kind: 'code',
          },
        ],
      });
      expect(settle(looping, 200)).toBe(true);
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
