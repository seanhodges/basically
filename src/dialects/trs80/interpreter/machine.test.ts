import { describe, expect, it } from 'vitest';
import type { MemoryBlock } from '../../types';
import { tokenizeProgram } from '../tokenizer';
import { plainChar } from '../charset';
import { trs80Samples } from '../samples';
import { Trs80InterpreterMachine } from './machine';

/** Row `r` of the machine's own screen reading, right-trimmed to assert on. */
function screenRow(m: Trs80InterpreterMachine, r: number): string {
  return (m.readScreenText()?.lines[r] ?? '').replace(/\s+$/, '');
}

describe('Trs80InterpreterMachine readScreenText', () => {
  it('reads back what a program printed', () => {
    const m = new Trs80InterpreterMachine();
    const { program } = tokenizeProgram('10 PRINT "HELLO"\n20 END\n');
    m.loadProgram(program);
    for (let i = 0; i < 5; i++) m.runFrame();
    const screen = m.readScreenText()!;
    expect(screen.cols).toBe(64);
    expect(screen.rows).toBe(16);
    expect(screen.lines[0]!.trimEnd()).toBe('HELLO');
    m.dispose();
  });

  it('pads every row to the full width rather than trimming', () => {
    const m = new Trs80InterpreterMachine();
    const { program } = tokenizeProgram('10 PRINT "HI"\n20 END\n');
    m.loadProgram(program);
    for (let i = 0; i < 5; i++) m.runFrame();
    const screen = m.readScreenText()!;
    expect(screen.lines).toHaveLength(16);
    // Code points, not UTF-16 units - the block graphics are astral.
    for (const line of screen.lines) expect([...line]).toHaveLength(64);
    m.dispose();
  });

  it('reads a screen with nothing on it as spaces, not as null', () => {
    // A blank screen is a real answer. null is reserved for "cannot determine",
    // which on this machine is unreachable: there is no ROM to boot and the
    // interpreter's video page exists from construction.
    const m = new Trs80InterpreterMachine();
    const screen = m.readScreenText()!;
    expect(screen).not.toBeNull();
    expect(screen.lines.join('').trim()).toBe('');
    m.dispose();
  });

  it('decodes block graphics to the same glyphs a listing shows', () => {
    const m = new Trs80InterpreterMachine();
    // 0x81 is the 2x3 sextant with only its top-left sub-cell set; the charset
    // maps it to the Unicode legacy-computing sextant, and so must the screen.
    m.interpreter.screen.video[0] = 0x81;
    m.interpreter.screen.video[1] = 0xbf; // all six sub-cells set
    const screen = m.readScreenText()!;
    // Astral glyphs: slice code points, not UTF-16 units.
    expect([...screen.lines[0]!].slice(0, 2).join('')).toBe(
      `${plainChar(0x81)}${plainChar(0xbf)}`,
    );
    // And the row still measures one code point per column.
    expect([...screen.lines[0]!]).toHaveLength(64);
    m.dispose();
  });

  it('reads codes with no printable form as spaces', () => {
    const m = new Trs80InterpreterMachine();
    m.interpreter.screen.video[0] = 0x00; // control
    m.interpreter.screen.video[1] = 0x80; // the blank graphics cell
    m.interpreter.screen.video[2] = 0xc5; // a space-compression code
    const screen = m.readScreenText()!;
    expect(screen.lines[0]!.slice(0, 3)).toBe('   ');
    m.dispose();
  });
});

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
