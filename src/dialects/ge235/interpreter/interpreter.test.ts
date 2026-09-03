// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from '../tokenizer';
import { Ge235InterpreterMachine } from './machine';
import { formatNumber } from './values';

/**
 * Frames a program gets before a test gives up on it. Generous because every
 * run starts with the compile pause - one to four seconds of it - and cheap
 * because the predicate trips as soon as the program stops.
 */
const MAX_FRAMES = 3000;

/** Run a program to a stop and return what it printed, blank tail trimmed. */
function run(source: string): string {
  const machine = new Ge235InterpreterMachine();
  machine.loadProgram(tokenizeProgram(source).image);
  for (let i = 0; i < MAX_FRAMES && machine.isProgramRunning(); i++) {
    machine.runFrame();
  }
  return machine.interpreter.terminal.text().replace(/\n+$/, '');
}

/** What a program printed, without the line every run closes with. */
function output(source: string): string {
  return run(source).replace(/\n*TIME[^\n]*$/, '');
}

describe('ge235 interpreter', () => {
  it('runs a program and reads its output back from readScreenText', () => {
    const machine = new Ge235InterpreterMachine();
    machine.loadProgram(tokenizeProgram('10 PRINT "HELLO"\n20 END\n').image);
    for (let i = 0; i < MAX_FRAMES && machine.isProgramRunning(); i++) {
      machine.runFrame();
    }
    const screen = machine.readScreenText()!;
    expect(screen.lines[0]!.trimEnd()).toBe('HELLO');
  });

  it('closes every run with the processor time it used', () => {
    // Time-sharing charged for the machine and said what it had charged for, so
    // even a program that prints nothing leaves that line on the paper.
    expect(run('10 END\n')).toMatch(/^\s*TIME\s+0\s+SECS\.$/);
  });

  it('prints in upper case whatever the program was typed in', () => {
    // The Teletype had one alphabet, and the charset folds onto it.
    expect(output('10 PRINT "hello"\n20 END\n')).toBe('HELLO');
  });

  it('deletes blanks outside string literals before reading a line', () => {
    // `trans` throws every blank away as it reads the line in, which is why a
    // spaced-out keyword and `GO TO` are the same words to the compiler.
    expect(output('10 P R I N T "OK"\n20 GO TO 40\n30 PRINT "NO"\n40 END\n')) //
      .toBe('OK');
  });

  it('requires LET on every assignment', () => {
    // A line opening with a letter reaches the jump table's dead slot, so the
    // program never runs at all - there is no time line under this message.
    expect(run('10 A=1\n20 END\n')).toBe('BAD INSTRUCTION IN 10');
  });

  it('formats numbers the way the run-time printed them', () => {
    const cases: [number, string][] = [
      [0, ' 0  '],
      [1, ' 1  '],
      [-42, '-42  '],
      [123456789, ' 123456789  '],
      [1 / 3, ' .333333  '],
      [-1.5, '-1.5  '],
      [0.0001, ' .0001  '],
      // Six significant digits, the seventh rounding the sixth away.
      [1.2345678, ' 1.23457  '],
      // Past the plain field the mantissa is scaled below one and the exponent
      // written out - with a blank where a later BASIC prints a plus.
      [1e10, ' .1 E 11  '],
      [-1.25e-9, '-.125 E-08  '],
    ];
    for (const [value, expected] of cases) {
      expect(formatNumber(value), `printing ${value}`).toBe(expected);
    }
  });

  it('tabs a comma into five zones and starts a new line past the last', () => {
    // Items land at 0, 15, 30, 45 and 60; the sixth has no zone to reach.
    const lines = output('10 PRINT 1,2,3,4,5,6\n20 END\n').split('\n');
    expect(lines[0]).toBe(
      ' 1'.padEnd(15) +
        ' 2'.padEnd(15) +
        ' 3'.padEnd(15) +
        ' 4'.padEnd(15) +
        ' 5',
    );
    expect(lines[1]).toBe(' 6');
  });

  it('prints nothing for a semicolon until the line is nearly full', () => {
    // The gap between two numbers is the pair of blanks each one carries; the
    // separator only acts at column 66, where it breaks the line.
    const lines = output(
      '10 FOR I=1 TO 20\n20 PRINT I;\n30 NEXT I\n40 PRINT\n50 END\n',
    ).split('\n');
    expect(lines[0]).toBe(
      ' 1   2   3   4   5   6   7   8   9   10   11   12   13   14   15',
    );
    expect(lines[1]).toBe(' 16   17   18   19   20');
  });

  it('holds the line open when PRINT ends on a separator', () => {
    expect(output('10 PRINT "A";\n20 PRINT "B"\n30 END\n')).toBe('AB');
  });

  it('counts FOR loops up, down and nested', () => {
    expect(
      output(
        '10 LET S=0\n20 FOR I=1 TO 10\n30 LET S=S+I\n40 NEXT I\n50 PRINT S\n60 END\n',
      ),
    ) //
      .toBe(' 55');
    expect(
      output(
        '10 FOR I=10 TO 1 STEP -3\n20 PRINT I;\n30 NEXT I\n40 PRINT\n50 END\n',
      ),
    ) //
      .toBe(' 10   7   4   1');
    expect(
      output(
        '10 FOR I=1 TO 2\n20 FOR J=1 TO 2\n30 PRINT I*10+J;\n40 NEXT J\n50 NEXT I\n60 PRINT\n70 END\n',
      ),
    ).toBe(' 11   12   21   22');
  });

  it('returns from a subroutine to the statement after the call', () => {
    expect(
      output(
        '10 GOSUB 40\n20 PRINT "BACK"\n30 GOTO 60\n40 PRINT "SUB"\n50 RETURN\n60 END\n',
      ),
    ).toBe('SUB\nBACK');
  });

  it('accepts the six relations the IF decoder reads, and no others', () => {
    const cases: [string, boolean][] = [
      ['=', true],
      ['<>', false],
      ['<', false],
      ['>', false],
      ['<=', true],
      ['>=', true],
    ];
    for (const [relation, taken] of cases) {
      const source = `10 IF 5${relation}5 THEN 30\n20 PRINT "NO"\n30 END\n`;
      expect(output(source), `relation ${relation}`).toBe(taken ? '' : 'NO');
    }
    // `=<` is not a relation: the decoder reads the `=` and stops.
    expect(run('10 IF 1=<2 THEN 30\n20 PRINT "NO"\n30 END\n')).toContain(
      'BAD FORMULA IN 10',
    );
  });

  it('reads DATA in program order and cannot rewind it', () => {
    expect(output('10 READ A,B\n20 DATA 3,-4\n30 PRINT A*B\n40 END\n')).toBe(
      '-12',
    );
    expect(run('10 DATA 1\n20 READ A,B\n30 END\n')).toContain(
      'NO DATA LEFT TO READ IN 20',
    );
  });

  it('calls a function defined below the line that uses it', () => {
    // The compiler collected every DEF before it checked a single call.
    expect(output('10 PRINT FNA(3)\n20 DEF FNA(X)=X*X+1\n30 END\n')).toBe(
      ' 10',
    );
  });

  it('gives a subscripted letter eleven places each way without a DIM', () => {
    expect(output('10 LET B(10)=7\n20 PRINT B(10)\n30 END\n')).toBe(' 7');
    expect(run('10 LET B(11)=7\n20 END\n')).toContain(
      'SUBSCRIPT OUT OF RANGE IN 10',
    );
    expect(
      output('10 DIM A(3,3)\n20 LET A(3,3)=9\n30 PRINT A(3,3)\n40 END\n'),
    ).toBe(' 9');
  });

  it('binds ↑ tightest and folds equal precedence left to right', () => {
    expect(output('10 PRINT 2↑3↑2\n20 END\n')).toBe(' 64');
    expect(output('10 PRINT -2↑2\n20 END\n')).toBe('-4');
    expect(output('10 PRINT 1+2*3\n20 END\n')).toBe(' 7');
  });

  it('trims INT toward zero rather than flooring it', () => {
    // The run-time negates a negative argument, takes the integer part of the
    // mantissa and recomplements, so INT walks toward zero from both sides. The
    // trap is INT(X+.5): it rounds for a non-negative X and trims for the rest.
    expect(output('10 PRINT INT(2.5)\n20 END\n')).toBe(' 2');
    expect(output('10 PRINT INT(-2.5)\n20 END\n')).toBe('-2');
    expect(output('10 PRINT INT(-.6+.5)\n20 END\n')).toBe(' 0');
  });

  it('reports the arithmetic faults the run-time reported', () => {
    const cases: [string, string][] = [
      ['1/0', 'DIVISION BY ZERO'],
      ['SQR(-1)', 'SQUARE ROOT OF A NEGATIVE NUMBER'],
      ['LOG(0)', 'LOG OF ZERO'],
      ['LOG(-1)', 'LOG OF A NEGATIVE NUMBER'],
      ['0↑-1', 'ZERO RAISED TO A NEGATIVE POWER'],
      ['(-2)↑2', 'NEGATIVE NUMBER RAISED TO A POWER'],
    ];
    for (const [formula, message] of cases) {
      expect(run(`10 PRINT ${formula}\n20 END\n`), formula).toContain(
        `${message} IN 10`,
      );
    }
  });

  it('lists every fault it can see before the run and then runs nothing', () => {
    const cases: [string, string][] = [
      ['10 PRINT "HI"\n', 'NO END INSTRUCTION IN 10'],
      ['10 END\n20 PRINT "X"\n30 END\n', 'END IS NOT THE LAST LINE IN 10'],
      ['10 GOTO 99\n20 END\n', 'UNDEFINED LINE NUMBER IN 10'],
      ['10 PRINT FNZ(1)\n20 END\n', 'UNDEFINED FUNCTION IN 10'],
      ['10 FOR I=1 TO 3\n20 PRINT I\n30 END\n', 'FOR WITH NO NEXT IN 30'],
      ['10 READ A\n20 PRINT A\n30 END\n', 'NO DATA TO READ IN 10'],
      ['10 DIM A1(3)\n20 END\n', 'BAD VARIABLE IN 10'],
    ];
    for (const [source, message] of cases) {
      const printed = run(source);
      expect(printed, message).toContain(message);
      // Nothing ran, so there is no time line under the list.
      expect(printed, message).not.toContain('TIME');
    }
  });

  it('asks for INPUT, echoes what is typed, and asks again for a non-number', () => {
    const machine = new Ge235InterpreterMachine();
    machine.loadProgram(
      tokenizeProgram('10 INPUT A\n20 PRINT A+1\n30 END\n').image,
    );
    for (let i = 0; i < MAX_FRAMES; i++) {
      machine.runFrame();
      if (machine.interpreter.state === 'input') break;
    }
    expect(machine.interpreter.terminal.readRow(0)).toBe('?');

    type(machine, 'X\r');
    for (let i = 0; i < 5; i++) machine.runFrame();
    expect(machine.interpreter.terminal.text()).toContain(
      'INPUT IS NOT A NUMBER, TYPE IT AGAIN',
    );

    type(machine, '41\r');
    for (let i = 0; i < MAX_FRAMES && machine.isProgramRunning(); i++) {
      machine.runFrame();
    }
    // The `41` on the paper is the teletype's own echo, not the program's.
    expect(machine.interpreter.terminal.text()).toContain('? 41');
    expect(machine.interpreter.terminal.text()).toContain(' 42');
  });
});

/** Type a line at the machine's keyboard, `\r` being the RETURN key. */
function type(machine: Ge235InterpreterMachine, text: string): void {
  for (const ch of text) {
    machine.keyEvent(
      { key: ch === '\r' ? 'Enter' : ch } as KeyboardEvent,
      true,
    );
  }
}
