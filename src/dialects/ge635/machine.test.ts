// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { ROWS } from '../../emulator/dartmouth/terminal';
import { GE635_COLUMNS } from './profile';
import { formatNumber } from './values';
import { Ge635InterpreterMachine } from './machine';

/**
 * Frames a program gets before a test gives up on it. Generous because every
 * run starts with the compile pause - one to four seconds of it - and cheap
 * because the predicate trips as soon as the program stops.
 */
const MAX_FRAMES = 3000;

/** Run a program to a stop and return what it printed, blank tail trimmed. */
function run(source: string): string {
  const machine = new Ge635InterpreterMachine();
  machine.loadProgram(tokenizeProgram(source).image);
  for (let i = 0; i < MAX_FRAMES && machine.isProgramRunning(); i++) {
    machine.runFrame();
  }
  return machine.interpreter.terminal.text().replace(/\n+$/, '');
}

/** What a program printed, without the line every run closes with. */
function output(source: string): string {
  return run(source)
    .replace(/\n*TIME:[^\n]*$/, '')
    .replace(/\n+$/, '');
}

/** Type a line at the machine's keyboard, `\r` being the RETURN key. */
function type(machine: Ge635InterpreterMachine, text: string): void {
  for (const ch of text) {
    machine.keyEvent(
      { key: ch === '\r' ? 'Enter' : ch } as KeyboardEvent,
      true,
    );
  }
}

/** Run to the first `INPUT`, answer it, and run on to the end. */
function answer(source: string, ...replies: string[]): string {
  const machine = new Ge635InterpreterMachine();
  machine.loadProgram(tokenizeProgram(source).image);
  for (const reply of replies) {
    for (let i = 0; i < MAX_FRAMES; i++) {
      machine.runFrame();
      if (machine.interpreter.state === 'input') break;
    }
    type(machine, `${reply}\r`);
  }
  for (let i = 0; i < MAX_FRAMES && machine.isProgramRunning(); i++) {
    machine.runFrame();
  }
  return machine.interpreter.terminal.text().replace(/\n+$/, '');
}

describe('Ge635InterpreterMachine', () => {
  it('reads blank paper as seventy-five blank columns', () => {
    // null is reserved for "cannot determine", which is unreachable here: there
    // is no ROM to boot and the roll exists from construction.
    const machine = new Ge635InterpreterMachine();
    const screen = machine.readScreenText()!;
    expect(screen.lines).toHaveLength(ROWS);
    for (const line of screen.lines) {
      expect([...line]).toHaveLength(GE635_COLUMNS);
    }
    expect(machine.displayWidth).toBe(GE635_COLUMNS * 8);
    expect(screen.lines.join('').trim()).toBe('');
    machine.dispose();
  });

  it('pauses to compile, then runs, then stops saying it is running', () => {
    const machine = new Ge635InterpreterMachine();
    machine.loadProgram(tokenizeProgram('10 PRINT "HI"\n20 END\n').image);
    expect(machine.isProgramRunning()).toBe(true);
    machine.runFrame();
    expect(machine.readScreenText()!.lines.join('').trim()).toBe('');
    for (let i = 0; i < MAX_FRAMES && machine.isProgramRunning(); i++) {
      machine.runFrame();
    }
    expect(machine.readScreenText()!.lines[0]!.trimEnd()).toBe('HI');
    expect(machine.readReport()!.isError).toBe(false);
    machine.dispose();
  });

  it('closes a run with the time line the manual ends every session on', () => {
    expect(run('10 END\n')).toMatch(/^\s*TIME: \.\d\d SECS\.$/);
  });
});

describe('ge635 numbers', () => {
  it('prints numbers by section 2.1s four rules', () => {
    const cases: [number, string][] = [
      // Rule 1: an integer keeps no decimal point, and carries one trailing
      // blank rather than the GE-235's two.
      [0, ' 0 '],
      [1, ' 1 '],
      [-42, '-42 '],
      [67108864, ' 67108864 '],
      // ...until it passes eight digits, where 2.1's own example takes over.
      [134217728, ' 1.34218 E+8 '],
      [32437580259, ' 3.24376 E+10 '],
      // Rule 2: six significant digits, and rule 4 drops the trailing zeros.
      [1 / 3, ' 0.333333 '],
      [-1.5, '-1.5 '],
      [2.5, ' 2.5 '],
      // Rule 3: below a tenth, the plain form survives only while six decimals
      // can say the number exactly. 0.03125 can; 0.0500548 cannot.
      [0.03125, ' 0.03125 '],
      [0.0625, ' 0.0625 '],
      [0.0500548, ' 5.00548 E-2 '],
    ];
    for (const [value, expected] of cases) {
      expect(formatNumber(value), `printing ${value}`).toBe(expected);
    }
  });

  it('breaks a packed line where the next number would pass column 75', () => {
    // Section 2.1's own printed run of the powers of two, which is the evidence
    // for both the 75-column line and the break belonging to the item.
    const lines = output(
      '10 FOR N=-5 TO 30\n20 PRINT 2↑N;\n30 NEXT N\n40 PRINT\n50 END\n',
    ).split('\n');
    expect(lines[0]).toBe(
      ' 0.03125  0.0625  0.125  0.25  0.5  1  2  4  8  16  32  64  128  256  512',
    );
    expect(lines[1]).toBe(
      ' 1024  2048  4096  8192  16384  32768  65536  131072  262144  524288',
    );
    expect(lines[2]).toBe(
      ' 1048576  2097152  4194304  8388608  16777216  33554432  67108864',
    );
    expect(lines[3]).toBe(
      ' 1.34218 E+8  2.68435 E+8  5.36871 E+8  1.07374 E+9',
    );
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(75);
  });

  it('tabs a comma into five zones of fifteen, which fill the line exactly', () => {
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

  it('moves the carriage to a TAB column, and ignores one already passed', () => {
    // Section 2.1: "PRINT X; TAB(12); Y; TAB(27); Z will cause the X-value to
    // start in column 0, the Y-values in column 12 and the Z-values in 27."
    const line = output(
      '10 LET X=1\n20 LET Y=2\n30 LET Z=3\n' +
        '40 PRINT X; TAB(12); Y; TAB(27); Z\n50 END\n',
    );
    expect(line.indexOf('2')).toBe(13);
    expect(line.indexOf('3')).toBe(28);
    // Already past column 2, so the TAB is ignored rather than wrapping.
    expect(output('10 PRINT 12345; TAB(2); 7\n20 END\n')).toBe(' 12345  7');
  });
});

describe('ge635 arithmetic', () => {
  it('floors INT on both sides of zero, so INT(X+.5) rounds', () => {
    // Section 2.2: "it gives the greatest integer not greater than x. Thus
    // INT(2.35) = 2, INT(-2.35) = -3" - where the GE-235 trims toward zero.
    expect(output('10 PRINT INT(2.35); INT(-2.35); INT(12)\n20 END\n')).toBe(
      ' 2 -3  12',
    );
    expect(output('10 PRINT INT(-.6+.5)\n20 END\n')).toBe('-1');
  });

  it('takes RND with no argument at all', () => {
    // Section 2.2: "the form of RND does not require an argument."
    const printed = output('10 PRINT INT(10*RND);\n20 END\n');
    expect(printed).toMatch(/^ \d$/);
    // Two runs of the same tape give the same numbers, which section 2.2 calls
    // out as what "greatly facilitates the debugging of programs".
    expect(output('10 PRINT INT(10*RND);\n20 END\n')).toBe(printed);
  });

  it('gives SGN, COT and the rest of the library', () => {
    expect(output('10 PRINT SGN(7.23); SGN(0); SGN(-.2387)\n20 END\n')).toBe(
      ' 1  0 -1',
    );
    expect(output('10 PRINT COT(1)\n20 END\n')).toBe(' 0.642093');
  });

  it('prints the arithmetic faults and carries on running', () => {
    // Section 2.8 divides its run-time table by whether the program survives:
    // each of these says what the computer "supplies" and that it "continues".
    const cases: [string, string][] = [
      ['1/0', 'DIVISION BY ZERO'],
      ['0↑-1', 'ZERO TO A NEGATIVE POWER'],
      ['(-3)↑2.7', 'ABSOLUTE VALUE RAISED TO POWER'],
      ['SQR(-4)', 'SQUARE ROOT OF A NEGATIVE NUMBER'],
      ['LOG(-1)', 'LOG OF A NEGATIVE NUMBER'],
      ['LOG(0)', 'LOG OF ZERO'],
      ['EXP(100)', 'EXP TOO LARGE'],
    ];
    for (const [formula, message] of cases) {
      const printed = run(`10 LET A=${formula}\n20 PRINT "ON"\n30 END\n`);
      expect(printed, formula).toContain(`${message} IN 10`);
      expect(printed, formula).toContain('ON');
      expect(printed, formula).toContain('TIME:');
    }
    // A whole exponent is multiplied out instead, and gets the sign right.
    expect(output('10 PRINT (-3)↑3\n20 END\n')).toBe('-27');
  });

  it('stops on the faults section 2.8 says the program stops on', () => {
    const cases: [string, string][] = [
      ['10 LET A(11)=1\n20 END\n', 'SUBSCRIPT ERROR IN 10'],
      ['10 RETURN\n20 END\n', 'RETURN WITH NO GOSUB IN 10'],
      ['10 ON 4 GO TO 20\n20 END\n', 'ON EVALUATED OUT OF RANGE IN 10'],
    ];
    for (const [source, message] of cases) {
      expect(run(source), message).toContain(message);
    }
  });
});

describe('ge635 statements', () => {
  it('assigns one value to several variables in a single LET', () => {
    // Section 1.7.1's own example, line for line.
    expect(
      output('10 LET X = Y3 = A(3,1) = 1\n20 PRINT X; Y3; A(3,1)\n30 END\n'),
    ).toBe(' 1  1  1');
  });

  it('takes an apostrophe at the end of a line as a remark', () => {
    // Section 2.5, including its own caveat: a line that ends in a string keeps
    // the apostrophe, because BASIC "will think it is part of the string".
    expect(output("10 PRINT 1 ' AND A REMARK\n20 END\n")).toBe(' 1');
    expect(output('10 PRINT "IT\'S HERE"\n20 END\n')).toBe("IT'S HERE");
  });

  it('does not run a loop whose limit is already behind its start', () => {
    // Section 1.7.7: "if you write 50 FOR Z = 2 TO -2, without a negative step
    // size, the body of the loop will not be performed."
    expect(
      output(
        '10 FOR Z=2 TO -2\n20 PRINT "IN"\n30 NEXT Z\n40 PRINT "OUT"\n50 END\n',
      ),
    ).toBe('OUT');
  });

  it('switches many ways on ON ... GO TO', () => {
    // Section 2.2's own use of it: ON SGN(X)+2 GO TO picks by the sign of X.
    const source = (x: string): string =>
      `10 LET X=${x}\n20 ON SGN(X)+2 GO TO 30,40,50\n` +
      '30 PRINT "NEG"\n35 STOP\n40 PRINT "ZERO"\n45 STOP\n' +
      '50 PRINT "POS"\n60 END\n';
    expect(output(source('-7'))).toBe('NEG');
    expect(output(source('0'))).toBe('ZERO');
    expect(output(source('7'))).toBe('POS');
  });

  it('rewinds the data block with RESTORE', () => {
    // Section 2.5's own worked shape: read, restore, pass over N, read again.
    expect(
      output(
        '10 READ N,A\n20 RESTORE\n30 READ B\n40 PRINT N; A; B\n' +
          '50 DATA 3,7\n60 END\n',
      ),
    ).toBe(' 3  7  3');
  });

  it('defines a function over several lines, closed by FNEND', () => {
    // Section 2.2's factorial, unchanged - including the bare FNF inside the
    // body, which "serves as a temporary variable for the computation".
    expect(
      output(
        '5 PRINT FNF(5)\n10 DEF FNF(N)\n20 LET FNF = 1\n' +
          '30 FOR K = 1 TO N\n40 LET FNF = K * FNF\n50 NEXT K\n' +
          '60 FNEND\n70 END\n',
      ),
    ).toBe(' 120');
  });

  it('defines a function of two variables, and one of none', () => {
    // Section 2.2: "each function defined may have zero, one, two, or more
    // variables", and a definition with none reads the program's own values.
    expect(
      output(
        '10 DEF FNB(X,Y) = 3*X*Y - Y↑3\n20 LET R=2\n' +
          '30 DEF FNA = 3.1416*R↑2\n40 PRINT FNB(2,3); FNA\n50 END\n',
      ),
    ).toBe('-9  12.5664');
  });
});

describe('ge635 strings', () => {
  it('reads and prints strings that DATA recognises by their first letter', () => {
    // Section 2.7's first example, which prints the word "time-sharing".
    expect(
      output(
        '10 READ A$, B$, C$\n20 PRINT C$; B$; A$\n' +
          '30 DATA ING, SHAR, TIME-\n40 END\n',
      ),
    ).toBe('TIME-SHARING');
  });

  it('keeps numbers and strings in two blocks, matched by variable type', () => {
    // Section 2.7's own mixed line: three numbers and three strings, with the
    // quotes carrying the two the first-letter rule would misread.
    expect(
      output(
        '10 READ A,B$,C,D$,E$,F\n20 PRINT A; C; F\n30 PRINT B$; "/"; D$; "/"; E$\n' +
          '90 DATA 10, ABC, 5, "4FG", "SEPT. 22, 1967", 2\n99 END\n',
      ),
    ).toBe(' 10  5  2\nABC/4FG/SEPT. 22, 1967');
  });

  it('rewinds one block at a time with RESTORE$ and RESTORE*', () => {
    expect(
      output(
        '10 READ A,A$\n20 RESTORE*\n30 READ B\n40 RESTORE$\n50 READ B$\n' +
          '60 PRINT A; B; A$; B$\n70 DATA 1, YES, 2, NO\n80 END\n',
      ),
    ).toBe(' 1  1 YESYES');
  });

  it('compares strings alphabetically and ignores trailing blanks', () => {
    // Section 2.7: "<" is "earlier in alphabetic order", and "YES" = "YES ".
    expect(
      output(
        '10 LET Y$ = "YES"\n20 IF Y$ = "YES " THEN 40\n' +
          '30 PRINT "NO"\n35 STOP\n40 PRINT "SAME"\n50 END\n',
      ),
    ).toBe('SAME');
    expect(
      output(
        '10 IF "APPLE" < "BANANA" THEN 30\n20 PRINT "NO"\n25 STOP\n' +
          '30 PRINT "EARLIER"\n40 END\n',
      ),
    ).toBe('EARLIER');
  });

  it('alphabetises a list of strings, as section 2.7s own program does', () => {
    expect(
      output(
        '10 DIM L$(50)\n20 READ N\n30 MAT READ L$(N)\n40 FOR I = 1 TO N\n' +
          '50 FOR J = 1 TO N-I\n60 IF L$(J) <= L$(J+1) THEN 100\n' +
          '70 LET A$ = L$(J)\n80 LET L$(J) = L$(J+1)\n90 LET L$(J+1) = A$\n' +
          '100 NEXT J\n110 NEXT I\n120 MAT PRINT L$\n' +
          '900 DATA 5, ONE, TWO, THREE, FOUR, FIVE\n999 END\n',
      ),
    ).toBe('FIVE\nFOUR\nONE\nTHREE\nTWO');
  });

  it('takes a string apart into its code numbers with CHANGE', () => {
    // Section 2.7's own walk, which prints the length and then the codes.
    expect(
      output(
        '5 DIM A(65)\n10 READ A$\n15 CHANGE A$ TO A\n20 FOR I = 0 TO A(0)\n' +
          '25 PRINT A(I);\n30 NEXT I\n35 PRINT\n40 DATA ABCDE\n45 END\n',
      ),
    ).toBe(' 5  65  66  67  68  69');
  });

  it('puts a string back together from the codes, reading A(0) as its length', () => {
    // The other direction of section 2.7's example, which prints ABCDE.
    expect(
      output(
        '10 FOR I = 0 TO 5\n15 READ A(I)\n20 NEXT I\n' +
          '25 DATA 5, 65, 66, 67, 68, 69\n30 CHANGE A TO A$\n' +
          '35 PRINT A$\n40 END\n',
      ),
    ).toBe('ABCDE');
  });

  it('takes a typed string at INPUT, and answers a question with one', () => {
    // Section 2.7's common use, with the semicolon holding the question mark on
    // the same line as the prompt.
    const printed = answer(
      '330 PRINT "DO YOU WISH TO CONTINUE";\n340 INPUT A$\n' +
        '350 IF A$ = "YES" THEN 370\n360 STOP\n370 PRINT "ON WE GO"\n380 END\n',
      'YES',
    );
    expect(printed).toContain('DO YOU WISH TO CONTINUE? YES');
    expect(printed).toContain('ON WE GO');
  });

  it('refuses to put a number in a string variable, or the reverse', () => {
    expect(run('10 LET A$ = 1\n20 END\n')).toContain(
      'MISMATCHED STRING OPERATION IN 10',
    );
    expect(run('10 LET A$="X"\n20 LET B = A$ + 1\n30 END\n')).toContain(
      'MISMATCHED STRING OPERATION IN 20',
    );
  });

  it('has no string matrices, only string vectors', () => {
    // Section 2.7 introduces "'string' vectors (but not 'string' matrices)".
    expect(run('10 DIM M$(3,3)\n20 END\n')).toContain('DIMENSION TOO LARGE');
  });
});
