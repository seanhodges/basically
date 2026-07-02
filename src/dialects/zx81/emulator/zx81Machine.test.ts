import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Zx81Machine } from './zx81Machine';
import { tokenizeProgram } from '../tokenizer';
import { buildPFile } from '../pfile';
import { D_FILE } from '../sysvars';

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

  it('takes more frames to finish the same program at a slower speed', () => {
    // ZX81 letter codes run A=0x26 .. Z=0x3F.
    const letter = (ch: string) => 0x26 + (ch.charCodeAt(0) - 65);
    const DONE = [...'DONE'].map(letter);
    // A busy loop long enough that its completion spans several frames, so
    // the run (not just the load handshake) is what setSpeed throttles.
    const src = '10 FOR I=1 TO 500\n20 NEXT I\n30 PRINT "DONE"\n';
    // setSpeed is applied after the load handshake (which relies on the
    // default 1x boot/flash-load timing) so only the run itself is throttled.
    function framesToDone(speed: number): number {
      const machine = new Zx81Machine({ rom, ramKb: 16 });
      const { bytes, errors } = tokenizeProgram(src);
      expect(errors).toEqual([]);
      machine.loadProgram(buildPFile(bytes));
      expect(displayContains(machine, DONE)).toBe(false);
      machine.setSpeed(speed);
      for (let i = 1; i <= 2000; i++) {
        machine.runFrame();
        if (displayContains(machine, DONE)) return i;
      }
      throw new Error('never displayed DONE');
    }
    const atFullSpeed = framesToDone(1);
    const atHalfSpeed = framesToDone(0.5);
    expect(atHalfSpeed).toBeGreaterThan(atFullSpeed);
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
