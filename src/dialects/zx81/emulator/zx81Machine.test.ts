import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Zx81Machine } from './zx81Machine';
import { tokenizeProgram } from '../tokenizer';
import { buildPFile } from '../pfile';
import { D_FILE } from '../sysvars';
import { zx81Charset } from '../charset';
import { formatBinaryDirective } from '../../binaryDirective';
import { buildRemRecord } from '../../../app/listingBlockEdit';
import { zx81ListingLayout } from '../listingLayout';

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../../public/roms/zx81.rom')),
);

function displayBytes(machine: Zx81Machine): number[] {
  const dfile = machine.mem.readWord(D_FILE);
  const out: number[] = [];
  let addr = dfile;
  for (let i = 0; i < 24 * 33 + 1 && addr < 0x10000; i++, addr++) {
    out.push(machine.mem.read(addr));
  }
  return out;
}

function displayContains(machine: Zx81Machine, needle: number[]): boolean {
  const d = displayBytes(machine);
  outer: for (let i = 0; i + needle.length <= d.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (d[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

describe('Zx81Machine', () => {
  it('boots the ROM to the K cursor', () => {
    const machine = new Zx81Machine({ rom, ramKb: 16 });
    machine.reset();
    machine.bootToBasic();
    // The boot screen shows the inverse-K cursor (code 0xB0) in the display file
    expect(displayContains(machine, [0xb0])).toBe(true);
  });

  it('flash-loads and runs 10 PRINT "HELLO"', () => {
    const machine = new Zx81Machine({ rom, ramKb: 16 });
    const { bytes, errors } = tokenizeProgram('10 PRINT "HELLO"\n');
    expect(errors).toEqual([]);
    machine.loadProgram(buildPFile(bytes));
    for (let i = 0; i < 200; i++) machine.runFrame();
    // H E L L O in ZX81 codes
    expect(displayContains(machine, [0x2d, 0x2a, 0x31, 0x31, 0x34])).toBe(true);
  });

  it('reads the display file back as text', () => {
    const machine = new Zx81Machine({ rom, ramKb: 16 });
    const { bytes } = tokenizeProgram('10 PRINT "HELLO"\n');
    machine.loadProgram(buildPFile(bytes));
    for (let i = 0; i < 200; i++) machine.runFrame();
    const s = machine.readScreenText()!;
    expect(s.cols).toBe(32);
    expect(s.rows).toBe(24);
    expect(s.lines).toHaveLength(24);
    // Every row is padded to the full width even though the ROM stores
    // variable-length rows terminated by NEWLINE.
    for (const line of s.lines) expect([...line]).toHaveLength(32);
    expect(s.lines.join('\n')).toContain('HELLO');
  });

  it('pads a collapsed display file out to the full rectangle', () => {
    // Fresh out of reset the display file is at its most collapsed - the ROM
    // has not expanded the empty rows - which is the case a fixed-rectangle
    // walk has to survive.
    const machine = new Zx81Machine({ rom, ramKb: 16 });
    machine.reset();
    machine.bootToBasic();
    const s = machine.readScreenText()!;
    expect(s.lines).toHaveLength(24);
    for (const line of s.lines) expect([...line]).toHaveLength(32);
  });

  it('decodes graphics to the same glyphs a listing shows', () => {
    const machine = new Zx81Machine({ rom, ramKb: 16 });
    machine.reset();
    machine.bootToBasic();
    // Write a known graphics code straight into the display file and check it
    // comes back as the charset's own Unicode block, not as an escape.
    const dfile = machine.mem.readWord(D_FILE);
    machine.mem.write(dfile + 1, 0x01); // a ZX81 block graphic
    const first = [...machine.readScreenText()!.lines[0]!][0]!;
    expect(first).toBe(zx81Charset.glyph(0x01));
    expect([...first]).toHaveLength(1);
  });

  it('starts from the auto-start line, skipping earlier lines', () => {
    const machine = new Zx81Machine({ rom, ramKb: 16 });
    const src = '10 PRINT "AA"\n20 PRINT "BB"\n30 STOP\n';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    machine.loadProgram(buildPFile(bytes), { autoStart: 20 });
    for (let i = 0; i < 200; i++) machine.runFrame();
    // "BB" printed, "AA" skipped (A = 0x26, B = 0x27 in ZX81 codes).
    expect(displayContains(machine, [0x27, 0x27])).toBe(true);
    expect(displayContains(machine, [0x26, 0x26])).toBe(false);
  });

  it('runs a FOR loop producing multiple lines', () => {
    const machine = new Zx81Machine({ rom, ramKb: 16 });
    const src = '10 FOR I=1 TO 3\n20 PRINT "ROW";I\n30 NEXT I\n';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    machine.loadProgram(buildPFile(bytes));
    for (let i = 0; i < 400; i++) machine.runFrame();
    // "ROW3" = R O W 3
    expect(displayContains(machine, [0x37, 0x34, 0x3c, 0x1f])).toBe(true);
  });

  it('reads program variables after running', () => {
    const machine = new Zx81Machine({ rom, ramKb: 16 });
    const src =
      '10 LET A=5\n20 LET B$="HI"\n30 DIM C(3)\n40 LET C(1)=7\n50 FOR I=1 TO 3\n60 STOP\n';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    machine.loadProgram(buildPFile(bytes));
    for (let i = 0; i < 400; i++) machine.runFrame();
    const vars = machine.readVariables();
    const byName = Object.fromEntries(vars.map((v) => [v.name, v]));
    expect(byName['A']).toMatchObject({ kind: 'number', value: '5' });
    expect(byName['B$']).toMatchObject({ kind: 'string', value: '"HI"' });
    expect(byName['C()']).toMatchObject({ kind: 'number-array' });
    expect(byName['C()']!.value).toContain('7');
    // The FOR loop is paused at line 60, so its control variable is live.
    expect(byName['I']).toMatchObject({ kind: 'number' });
  });

  it('reports plausible actual RAM figures while a program runs', () => {
    const machine = new Zx81Machine({ rom, ramKb: 16 });
    const { bytes, errors } = tokenizeProgram('10 PRINT "HELLO"\n');
    expect(errors).toEqual([]);
    machine.loadProgram(buildPFile(bytes));
    for (let i = 0; i < 200; i++) machine.runFrame();
    const stats = machine.readMemoryStats();
    expect(stats).not.toBeNull();
    // The sysvars alone are 0x74 bytes, so used must exceed them; everything
    // must fit in the 16K pack (RAMTOP = 0x8000, base = 0x4009).
    expect(stats!.used).toBeGreaterThan(0x74);
    expect(stats!.free).toBeGreaterThan(0);
    expect(stats!.used + stats!.free).toBeLessThanOrEqual(16 * 1024);
  });

  it('reports more RAM used after DIMming a large array', () => {
    const machine = new Zx81Machine({ rom, ramKb: 16 });
    const before = (() => {
      const { bytes } = tokenizeProgram('10 PRINT "HI"\n');
      machine.loadProgram(buildPFile(bytes));
      for (let i = 0; i < 200; i++) machine.runFrame();
      return machine.readMemoryStats()!;
    })();
    const machine2 = new Zx81Machine({ rom, ramKb: 16 });
    const { bytes } = tokenizeProgram('10 DIM A(500)\n20 PRINT "HI"\n');
    machine2.loadProgram(buildPFile(bytes));
    for (let i = 0; i < 200; i++) machine2.runFrame();
    const after = machine2.readMemoryStats()!;
    // 500 five-byte floats ≈ 2.5K more in use.
    expect(after.used).toBeGreaterThan(before.used + 2000);
    expect(after.free).toBeLessThan(before.free);
  });

  it('reports a runtime error after running a buggy program', () => {
    const machine = new Zx81Machine({ rom, ramKb: 16 });
    // Using an undefined variable is ZX81 report 2 ("Undefined variable").
    const { bytes, errors } = tokenizeProgram('10 PRINT A\n');
    expect(errors).toEqual([]);
    machine.loadProgram(buildPFile(bytes));
    for (let i = 0; i < 200; i++) machine.runFrame();
    const report = machine.readReport();
    expect(report.isError).toBe(true);
    expect(report.code).toBe('2');
    expect(report.line).toBe(10);
  });

  it('reports no error after a clean program', () => {
    const machine = new Zx81Machine({ rom, ramKb: 16 });
    const { bytes } = tokenizeProgram('10 PRINT "HELLO"\n');
    machine.loadProgram(buildPFile(bytes));
    for (let i = 0; i < 200; i++) machine.runFrame();
    expect(machine.readReport().isError).toBe(false);
  });

  it('continues past a SAVE statement instead of spinning in the tape loop', () => {
    // Self-saving loaders (common in ZX81 games) run SAVE before starting.
    // With no cassette output wired up, the ROM's tape-output loop would spin
    // forever; the SAVE trap skips it so the next line still runs. A=0x26,
    // B=0x27 in ZX81 codes.
    const machine = new Zx81Machine({ rom, ramKb: 16 });
    const src = '10 PRINT "AA"\n20 SAVE "X"\n30 PRINT "BB"\n';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    machine.loadProgram(buildPFile(bytes));
    for (let i = 0; i < 200; i++) machine.runFrame();
    // Line 30 ran (BB) and no runtime error was raised.
    expect(displayContains(machine, [0x27, 0x27])).toBe(true);
    expect(machine.readReport().isError).toBe(false);
  });

  it('disposes idempotently and stays inert afterwards', () => {
    const machine = new Zx81Machine({ rom, ramKb: 16 });
    const { bytes } = tokenizeProgram('10 PRINT "HELLO"\n');
    machine.loadProgram(buildPFile(bytes));
    machine.dispose();
    // Releasing keys / disposing again must not throw.
    expect(() => {
      machine.releaseAllKeys();
      machine.dispose();
    }).not.toThrow();
  });

  /**
   * The run-state latch. The ROM address it fires on is a fact about the
   * committed image, so these cases reproduce the trace rather than asserting
   * the constant: each program is run on the real ROM and the machine is asked
   * what it says about itself. A different ROM revision fails here rather than
   * silently misreporting.
   */
  describe('isProgramRunning', () => {
    function load(src: string): Zx81Machine {
      const machine = new Zx81Machine({ rom, ramKb: 16 });
      const { bytes, errors } = tokenizeProgram(src);
      expect(errors).toEqual([]);
      machine.loadProgram(buildPFile(bytes));
      return machine;
    }

    /** Frames until the machine reports the program stopped, or the cap. */
    function settle(machine: Zx81Machine, frames = 600): boolean | null {
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
      ['GOSUB and RETURN', '10 GOSUB 40\n20 PRINT "BACK"\n30 STOP\n40 RETURN\n'],
      [
        'a program that fills the screen',
        '10 FOR I=1 TO 30\n20 PRINT "ROW";I\n30 NEXT I\n',
      ],
    ])('reports no program running after %s', (_name, src) => {
      expect(settle(load(src))).toBe(false);
    });

    it.each([
      ['an idle loop', '10 GOTO 10\n'],
      ['an INKEY$ loop', '10 IF INKEY$="" THEN GOTO 10\n'],
      ['PAUSE', '10 PAUSE 30000\n20 GOTO 10\n'],
      // The case every screen-shaped or cursor-shaped heuristic gets wrong: the
      // ZX81 shows the same cursor at an INPUT prompt as it does in the editor.
      ['an INPUT prompt', '10 INPUT A\n20 GOTO 10\n'],
    ])('goes on reporting a program running at %s', (_name, src) => {
      expect(settle(load(src), 200)).toBe(true);
    });

    it('reports no program running once BREAK stops one', () => {
      const machine = load('10 GOTO 10\n');
      for (let i = 0; i < 60; i++) machine.runFrame();
      expect(machine.isProgramRunning()).toBe(true);
      machine.setKey('Space', true);
      for (let i = 0; i < 8; i++) machine.runFrame();
      machine.setKey('Space', false);
      expect(settle(machine, 60)).toBe(false);
    });
  });

  describe('step-through debugging', () => {
    // A tight loop that revisits lines 20 and 30 every iteration, so the
    // "about to execute" line cycles 20 → 30 → 20 predictably.
    const LOOP_SRC = '10 FOR I=1 TO 1000\n20 LET A=I\n30 NEXT I\n';

    function load(): Zx81Machine {
      const machine = new Zx81Machine({ rom, ramKb: 16 });
      const { bytes, errors } = tokenizeProgram(LOOP_SRC);
      expect(errors).toEqual([]);
      machine.loadProgram(buildPFile(bytes));
      return machine;
    }

    /** Drive debugStep until it pauses (or give up), returning the result. */
    function runToPause(
      machine: Zx81Machine,
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

    function readI(machine: Zx81Machine): number {
      const v = machine.readVariables().find((x) => x.name === 'I');
      return Number(v?.value);
    }

    it('reports a current line inside the running program', () => {
      const machine = load();
      const line = machine.currentLine();
      expect(line === 20 || line === 30 || line === 10).toBe(true);
    });

    it('pauses at a breakpointed line in run mode', () => {
      const machine = load();
      const res = runToPause(machine, 'run', new Set([20]), null);
      expect(res).toEqual({ paused: true, line: 20 });
    });

    it('steps to the next BASIC line', () => {
      const machine = load();
      runToPause(machine, 'run', new Set([20]), null);
      const res = runToPause(machine, 'step', new Set(), 20);
      expect(res.paused).toBe(true);
      expect(res.line).toBe(30);
    });

    it('continue off a breakpointed line advances a loop iteration', () => {
      const machine = load();
      runToPause(machine, 'run', new Set([20]), null);
      const before = readI(machine);
      // Continue with line 20 still breakpointed and as the pause origin: it
      // must leave line 20 before re-pausing there, so the loop counter moves.
      const res = runToPause(machine, 'run', new Set([20]), 20);
      expect(res.line).toBe(20);
      expect(readI(machine)).toBe(before + 1);
    });
  });

  describe('machine code in REM lines (monolithic .P image)', () => {
    it('carries #BIN REM code into RAM through the image, with no injection', () => {
      // A line-1 REM holding machine code: its body lands at the classic 16514
      // (0x4082) because it rides inside the .P image, not via RAM injection.
      const machine = new Zx81Machine({ rom, ramKb: 16 });
      const code = new Uint8Array([0x3e, 0x2a, 0xc9]); // LD A,42 : RET
      const rem = formatBinaryDirective(
        buildRemRecord(1, code, zx81ListingLayout),
      );
      const { bytes, errors } = tokenizeProgram(`${rem}\n10 PRINT "HI"\n`);
      expect(errors).toEqual([]);
      machine.loadProgram(buildPFile(bytes));
      const readBack = Array.from(code, (_, i) => machine.mem.read(0x4082 + i));
      expect(readBack).toEqual(Array.from(code));
    });

    it('reflects REM-embedded data through PEEK at its listing address', () => {
      // 16514 == 0x4082, the code body of a line-1 REM. The program PEEKs the
      // first byte the REM carries - proof the data is live from the image.
      const machine = new Zx81Machine({ rom, ramKb: 16 });
      const rem = formatBinaryDirective(
        buildRemRecord(1, new Uint8Array([42]), zx81ListingLayout),
      );
      const { bytes, errors } = tokenizeProgram(
        `${rem}\n10 PRINT PEEK 16514\n`,
      );
      expect(errors).toEqual([]);
      machine.loadProgram(buildPFile(bytes));
      for (let i = 0; i < 200; i++) machine.runFrame();
      // "42" in ZX81 display codes: '4' = 0x20, '2' = 0x1E.
      expect(displayContains(machine, [0x20, 0x1e])).toBe(true);
    });
  });

  it('responds to emulated keypresses', () => {
    const machine = new Zx81Machine({ rom, ramKb: 16 });
    const src = '10 IF INKEY$="" THEN GOTO 10\n20 PRINT "KEY ";INKEY$\n';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    machine.loadProgram(buildPFile(bytes));
    for (let i = 0; i < 100; i++) machine.runFrame();
    machine.keyEvent({ code: 'KeyQ' } as KeyboardEvent, true);
    for (let i = 0; i < 100; i++) machine.runFrame();
    machine.keyEvent({ code: 'KeyQ' } as KeyboardEvent, false);
    // "KEY Q"
    expect(displayContains(machine, [0x30, 0x2a, 0x3e, 0x00, 0x36])).toBe(true);
  });
});
