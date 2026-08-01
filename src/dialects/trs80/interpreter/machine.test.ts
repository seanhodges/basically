import { describe, expect, it } from 'vitest';
import type { MemoryBlock } from '../../types';
import { tokenizeProgram } from '../tokenizer';
import { COLS } from '../emulator/display';
import { trs80Samples } from '../samples';
import { Trs80InterpreterMachine } from './machine';

function screenRow(m: Trs80InterpreterMachine, r: number): string {
  const video = m.interpreter.screen.video;
  let s = '';
  for (let c = 0; c < COLS; c++) {
    const code = video[r * COLS + c]!;
    s += code >= 0x20 && code < 0x80 ? String.fromCharCode(code) : ' ';
  }
  return s.replace(/\s+$/, '');
}

describe('Trs80InterpreterMachine', () => {
  it('runs a tokenized program ROM-free and renders to video RAM', () => {
    const m = new Trs80InterpreterMachine();
    const { program, errors } = tokenizeProgram('10 PRINT "HELLO"\n20 END\n');
    expect(errors).toEqual([]);
    m.loadProgram(program);
    for (let i = 0; i < 5; i++) m.runFrame();
    expect(screenRow(m, 0)).toBe('HELLO');
    expect(m.readReport()).toBeNull(); // clean exit, no error
    m.dispose();
  });

  it('runs breakout at a playable rate (no instant game-over)', () => {
    // Guards STATEMENTS_PER_FRAME calibration: at the old 4000 stmt/frame the
    // ball's whole fall completed inside the first runFrame() and the player
    // only saw "GAME OVER". At authentic speed the game is still in play after
    // several frames of no input.
    const breakout = trs80Samples.find((s) => s.name === 'breakout.bas')!;
    const { program, errors } = tokenizeProgram(breakout.text);
    expect(errors).toEqual([]);
    const m = new Trs80InterpreterMachine();
    m.loadProgram(program);
    for (let i = 0; i < 10; i++) m.runFrame();
    expect(m.interpreter.state).toBe('running');
    m.dispose();
  });

  it('keeps an animation/idle loop yielding without ending', () => {
    const m = new Trs80InterpreterMachine();
    const { program } = tokenizeProgram('10 PRINT "X";\n20 GOTO 10\n');
    m.loadProgram(program);
    m.runFrame();
    // An infinite loop never reaches "ended"; the frame budget bounds the work.
    expect(m.currentLine()).not.toBeNull();
    m.dispose();
  });

  it('takes more frames to finish the same program at a slower speed', () => {
    // A busy loop long enough that its completion spans many frames, so the
    // run (not just the load) is what setSpeed throttles.
    const src = '10 FOR I=1 TO 1000\n20 NEXT I\n30 PRINT "DONE"\n40 END\n';
    function framesToDone(speed: number): number {
      const m = new Trs80InterpreterMachine();
      const { program, errors } = tokenizeProgram(src);
      expect(errors).toEqual([]);
      m.loadProgram(program);
      m.setSpeed(speed);
      for (let i = 1; i <= 2000; i++) {
        m.runFrame();
        if (screenRow(m, 0) === 'DONE') {
          m.dispose();
          return i;
        }
      }
      throw new Error('never displayed DONE');
    }
    const atFullSpeed = framesToDone(1);
    const atHalfSpeed = framesToDone(0.5);
    expect(atHalfSpeed).toBeGreaterThan(atFullSpeed);
  });

  it('surfaces a runtime error through readReport', () => {
    const m = new Trs80InterpreterMachine();
    const { program } = tokenizeProgram('10 PRINT 1/0\n');
    m.loadProgram(program);
    for (let i = 0; i < 5; i++) m.runFrame();
    const report = m.readReport();
    expect(report?.isError).toBe(true);
    expect(report?.code).toBe('/0');
    m.dispose();
  });

  it('single-steps through BASIC lines for the debugger', () => {
    const m = new Trs80InterpreterMachine();
    const { program } = tokenizeProgram('10 A=1\n20 A=2\n30 A=3\n');
    m.loadProgram(program);
    const visited: (number | null)[] = [];
    let from: number | null = null;
    for (let i = 0; i < 10; i++) {
      const r = m.debugStep({
        mode: 'step',
        fromLine: from,
        breakpoints: new Set(),
      });
      if (!r.paused) break;
      visited.push(r.line);
      from = r.line;
    }
    expect(visited).toEqual([10, 20, 30]);
  });

  describe('memory blocks', () => {
    function block(overrides: Partial<MemoryBlock> = {}): MemoryBlock {
      return {
        id: 'b1',
        name: 'code1',
        address: 0x7000,
        bytes: new Uint8Array([123]),
        kind: 'code',
        ...overrides,
      };
    }

    it('injects block bytes into memory after the reset-and-zero load', () => {
      const m = new Trs80InterpreterMachine();
      const { program, errors } = tokenizeProgram('10 END\n');
      expect(errors).toEqual([]);
      m.loadProgram(program, { blocks: [block()] });
      // load() -> reset() zeroes memory, so a read-back proves the block was
      // written afterwards rather than being clobbered by the reset.
      expect(m.interpreter.peek(0x7000)).toBe(123);
      m.dispose();
    });

    it('reflects an injected block through PEEK', () => {
      const m = new Trs80InterpreterMachine();
      const { program, errors } = tokenizeProgram('10 PRINT PEEK(28672)\n');
      expect(errors).toEqual([]);
      m.loadProgram(program, { blocks: [block()] });
      for (let i = 0; i < 5; i++) m.runFrame();
      expect(screenRow(m, 0)).toContain('123');
      m.dispose();
    });

    it('is a no-op when no blocks are supplied', () => {
      const m = new Trs80InterpreterMachine();
      const { program } = tokenizeProgram('10 END\n');
      m.loadProgram(program);
      expect(m.interpreter.peek(0x7000)).toBe(0);
      m.dispose();
    });
  });

  it('reports scalar variables for the watcher', () => {
    const m = new Trs80InterpreterMachine();
    const { program } = tokenizeProgram('10 A=5\n20 B$="HI"\n30 END\n');
    m.loadProgram(program);
    for (let i = 0; i < 5; i++) m.runFrame();
    const vars = m.readVariables();
    expect(vars).toContainEqual({ name: 'A', kind: 'number', value: '5' });
    expect(vars).toContainEqual({ name: 'B$', kind: 'string', value: 'HI' });
    m.dispose();
  });
  describe('run state', () => {
    function machineFor(src: string, frames: number) {
      const m = new Trs80InterpreterMachine();
      const { program } = tokenizeProgram(src);
      m.loadProgram(program);
      for (let i = 0; i < frames; i++) m.runFrame();
      return m;
    }

    it('reports a looping program as running', () => {
      const m = machineFor('10 GOTO 10\n', 50);
      expect(m.isProgramRunning()).toBe(true);
      m.dispose();
    });

    it('reports a finished program as not running', () => {
      const m = machineFor('10 PRINT "HI"\n20 END\n', 50);
      expect(m.isProgramRunning()).toBe(false);
      m.dispose();
    });

    it('reports a program stopped by an error as not running', () => {
      const m = machineFor('10 PRINT 1/0\n', 50);
      expect(m.readReport()?.isError).toBe(true);
      expect(m.isProgramRunning()).toBe(false);
      m.dispose();
    });

    it('counts a program blocked on INPUT as still running', () => {
      // INPUT hasn't ended the program, it is waiting on the user.
      const m = machineFor('10 INPUT A\n20 GOTO 10\n', 50);
      expect(m.isProgramRunning()).toBe(true);
      m.dispose();
    });
  });
});
