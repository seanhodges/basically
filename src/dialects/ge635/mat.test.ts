// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { Ge635InterpreterMachine } from './machine';

/**
 * The `MAT` statements, checked against section 2.6's own worked programs.
 *
 * Section 2.6 counts "a special set of thirteen instructions" and prints two
 * complete programs with their output, so most of what is asserted here is the
 * manual's own paper rather than a reading of it. Where a number here is not
 * the manual's - the Hilbert inverse, which it prints with the round-off of a
 * six-digit float - the assertion is loosened to what the algebra says rather
 * than tightened to a figure this arithmetic cannot reproduce.
 */

/** As in the machine's own tests: enough frames to cover a compile pause. */
const MAX_FRAMES = 3000;

function run(source: string): string {
  const machine = new Ge635InterpreterMachine();
  machine.loadProgram(tokenizeProgram(source).image);
  for (let i = 0; i < MAX_FRAMES && machine.isProgramRunning(); i++) {
    machine.runFrame();
  }
  return machine.interpreter.terminal.text().replace(/\n+$/, '');
}

function output(source: string): string {
  return run(source)
    .replace(/\n*TIME:[^\n]*$/, '')
    .replace(/\n+$/, '');
}

/** Answer one `MAT INPUT` and run on to the end. */
function answer(source: string, ...replies: string[]): string {
  const machine = new Ge635InterpreterMachine();
  machine.loadProgram(tokenizeProgram(source).image);
  for (const reply of replies) {
    for (let i = 0; i < MAX_FRAMES; i++) {
      machine.runFrame();
      if (machine.interpreter.state === 'input') break;
    }
    for (const ch of `${reply}\r`) {
      machine.keyEvent(
        { key: ch === '\r' ? 'Enter' : ch } as KeyboardEvent,
        true,
      );
    }
  }
  for (let i = 0; i < MAX_FRAMES && machine.isProgramRunning(); i++) {
    machine.runFrame();
  }
  return machine.interpreter.terminal.text().replace(/\n+$/, '');
}

/** Three zoned items on one line, as `MAT PRINT` without a `;` lays them out. */
function zoned(...items: string[]): string {
  return items
    .map((item, i) => (i === items.length - 1 ? item : item.padEnd(15)))
    .join('');
}

describe('ge635 MAT', () => {
  it('runs section 2.6s own matrix program', () => {
    // The manual's first illustration, line for line. It reads A and B in line
    // 30 and in so doing sets up the correct dimensions, adds A to itself, and
    // multiplies - showing both MAT PRINT formats.
    const printed = output(
      '10 DIM A(20,20),B(20,20),C(20,20)\n' +
        '20 READ M,N\n' +
        '30 MAT READ A(M,N),B(N,N)\n' +
        '40 MAT C = A + A\n' +
        '50 MAT PRINT C;\n' +
        '60 MAT C = A*B\n' +
        '70 PRINT\n' +
        '75 PRINT "A*B =",\n' +
        '80 MAT PRINT C\n' +
        '90 DATA 2,3\n' +
        '91 DATA 1,2,3\n' +
        '92 DATA 4,5,6\n' +
        '93 DATA 1,0,-1\n' +
        '94 DATA 0,-1,-1\n' +
        '95 DATA -1,0,0\n' +
        '99 END\n',
    ).split('\n');
    expect(printed[0]).toBe(' 2  4  6');
    expect(printed[1]).toBe(' 8  10  12');
    expect(printed[3]).toBe('A*B =');
    expect(printed[4]).toBe(zoned('-2', '-2', '-3'));
    expect(printed[5]).toBe(zoned('-2', '-5', '-9'));
  });

  it('fills a matrix with zeros, ones and the identity', () => {
    expect(
      output(
        '10 MAT A = ZER(2,2)\n20 MAT B = CON(2,2)\n30 MAT C = IDN(2,2)\n' +
          '40 MAT PRINT A;\n50 MAT PRINT B;\n60 MAT PRINT C;\n70 END\n',
      ),
    ).toBe(' 0  0\n 0  0\n 1  1\n 1  1\n 1  0\n 0  1');
  });

  it('transposes, scales and copies', () => {
    // MAT C = (K)*A, with the number in parentheses section 2.6 requires.
    expect(
      output(
        '10 DIM A(2,3),B(3,2),C(2,3)\n20 MAT READ A(2,3)\n' +
          '30 MAT B = TRN(A)\n40 MAT C = (10)*A\n' +
          '50 MAT PRINT B;\n60 MAT PRINT C;\n' +
          '70 DATA 1,2,3,4,5,6\n80 END\n',
      ),
    ).toBe(' 1  4\n 2  5\n 3  6\n 10  20  30\n 40  50  60');
  });

  it('inverts a matrix and leaves its determinant in DET', () => {
    expect(
      output(
        '10 DIM A(2,2),B(2,2)\n20 MAT READ A(2,2)\n30 MAT B = INV(A)\n' +
          '40 MAT PRINT B;\n50 PRINT "DET ="; DET\n' +
          '60 DATA 4,7,2,6\n70 END\n',
      ),
    ).toBe(' 0.6 -0.7\n-0.2  0.4\nDET = 10');
  });

  it('inverts section 2.6s Hilbert matrix and prints its determinant', () => {
    // The manual's second illustration. Its own printed inverse carries the
    // round-off of a six-digit float (16.0001, -120.001, ...), which this
    // arithmetic does not reproduce, so the assertion is on the algebra: the
    // exact inverse of the 4-by-4 Hilbert matrix, and a determinant of about
    // 1.65E-7 - which is what the manual prints as 1.65342 E-7.
    const printed = output(
      '5 REM THIS PROGRAM INVERTS AN N-BY-N HILBERT MATRIX\n' +
        '10 DIM A(20,20),B(20,20)\n' +
        '20 READ N\n' +
        '30 MAT A = CON(N,N)\n' +
        '50 FOR I = 1 TO N\n' +
        '60 FOR J = 1 TO N\n' +
        '70 LET A(I,J) = 1/(I+J-1)\n' +
        '80 NEXT J\n' +
        '90 NEXT I\n' +
        '100 MAT B = INV(A)\n' +
        '115 PRINT "INV(A) =",\n' +
        '120 MAT PRINT B;\n' +
        '125 PRINT\n' +
        '130 PRINT "DETERMINANT OF A ="; DET\n' +
        '190 DATA 4\n' +
        '199 END\n',
    ).split('\n');
    expect(printed[0]).toBe('INV(A) =');
    const first = printed[1]!.trim().split(/\s+/).map(Number);
    expect(first.map(Math.round)).toEqual([16, -120, 240, -140]);
    expect(printed[6]).toMatch(/^DETERMINANT OF A = 1\.65\d+ E-7$/);
  });

  it('takes its dimensions from a MAT statement, inside the room DIM saved', () => {
    // Section 2.6's own walk through the difference between the space DIM
    // reserves and the dimension a MAT gives: 20 by 7 is (20+1)x(7+1) = 168
    // components, and (16+1)x(10+1) = 187 does not fit, while (25+1)x(5+1) does.
    expect(
      output(
        '10 DIM M(20,7)\n20 MAT M = ZER(15,7)\n30 PRINT "FITS"\n' +
          '40 MAT M = ZER(25,5)\n50 PRINT "ALSO FITS"\n60 END\n',
      ),
    ).toBe('FITS\nALSO FITS');
    expect(run('10 DIM M(20,7)\n20 MAT M = ZER(16,10)\n30 END\n')).toContain(
      'DIMENSION ERROR IN 20',
    );
  });

  it('ignores row and column zero, but redimensioning still moves them', () => {
    // Section 2.6's trap, stated outright: "even if we have first LET M(1,0) =
    // M(2,0) = 1, say, and then MAT READ M(2,2) the values of M(1,0) and M(2,0)
    // will now be 0."
    expect(
      output(
        '10 DIM M(5,5)\n20 LET M(1,0) = M(2,0) = 1\n30 MAT READ M(2,2)\n' +
          '40 PRINT M(1,0); M(2,0); M(1,1); M(2,2)\n' +
          '50 DATA 7,8,9,10\n60 END\n',
      ),
    ).toBe(' 0  0  7  10');
  });

  it('prints a vector down the page, or across it when a separator says so', () => {
    // Section 2.6: "MAT PRINT V will print the vector V as a column vector.
    // MAT PRINT V, will print V as a row vector... while MAT PRINT V; will
    // print V as a row vector, closely packed."
    const source = (separator: string): string =>
      `10 DIM V(3)\n20 MAT READ V(3)\n30 MAT PRINT V${separator}\n` +
      '40 DATA 1,2,3\n50 END\n';
    expect(output(source(''))).toBe(' 1\n 2\n 3');
    expect(output(source(';'))).toBe(' 1  2  3');
    expect(output(source(','))).toBe(zoned(' 1', ' 2', ' 3'));
  });

  it('reads a vector at MAT INPUT and counts it into NUM', () => {
    // Section 2.6's averaging program, which "takes advantage of the fact that
    // zero numbers may be inputted, and uses this as a signal to stop".
    const source =
      '5 LET S = 0\n10 MAT INPUT V\n20 LET N = NUM\n30 IF N = 0 THEN 99\n' +
      '40 FOR I = 1 TO N\n45 LET S = S + V(I)\n50 NEXT I\n' +
      '60 PRINT S/N\n70 GO TO 5\n99 END\n';
    const printed = answer(source, '2,4,9', '');
    expect(printed).toContain('? 2,4,9');
    expect(printed).toContain(' 5');
  });

  it('asks for more input when a MAT INPUT line ends in an ampersand', () => {
    // Section 2.6: "by ending the line of input with & (before carriage return)
    // the machine will ask for more input on the next line."
    const printed = answer(
      '10 MAT INPUT V\n20 PRINT NUM; V(1); V(4)\n30 END\n',
      '1,2,3&',
      '4',
    );
    expect(printed).toContain(' 4  1  4');
  });

  it('reads and prints a list of strings', () => {
    // Section 2.7: "MAT PRINT M$; will cause the members of the list to be
    // printed without spaces between them."
    expect(
      output(
        '10 DIM M$(3)\n20 MAT READ M$(3)\n30 MAT PRINT M$;\n' +
          '40 DATA TIME, "-", SHARING\n50 END\n',
      ),
    ).toBe('TIME-SHARING');
  });

  it('refuses an operation the dimensions do not allow', () => {
    // Section 2.6: "for these to be legal A and B must have the same
    // dimensions", and for a product "the number of columns in A" must equal
    // "the number of rows in B".
    expect(
      run(
        '10 DIM A(2,2),B(3,3),C(4,4)\n20 MAT A = CON(2,2)\n' +
          '30 MAT B = CON(3,3)\n40 MAT C = A + B\n50 END\n',
      ),
    ).toContain('DIMENSION ERROR IN 40');
  });

  it('refuses to multiply or transpose a matrix into itself', () => {
    // Section 2.8 names both: "MAT A = TRN(A) is illegal" and "MAT A = A * B
    // is illegal". Either would overwrite components the operation still needs.
    expect(
      run('10 DIM A(2,2)\n20 MAT A = CON(2,2)\n30 MAT A = TRN(A)\n40 END\n'),
    ).toContain('ILLEGAL MAT TRANSPOSE IN 30');
    expect(
      run(
        '10 DIM A(2,2),B(2,2)\n20 MAT A = CON(2,2)\n30 MAT B = CON(2,2)\n' +
          '40 MAT A = A * B\n50 END\n',
      ),
    ).toContain('ILLEGAL MAT MULTIPLE IN 40');
    // MAT A = A + B is legal, and so is a product into a third matrix.
    expect(
      output(
        '10 DIM A(1,1),B(1,1)\n20 MAT A = CON(1,1)\n30 MAT B = CON(1,1)\n' +
          '40 MAT A = A + B\n50 MAT PRINT A;\n60 END\n',
      ),
    ).toBe(' 2');
  });

  it('does not stop on a singular matrix, and sets DET to zero', () => {
    // Section 2.6: "attempting to invert a singular matrix will not cause the
    // program to stop, but DET is set equal to 0."
    expect(
      output(
        '10 DIM A(2,2),B(2,2)\n20 MAT READ A(2,2)\n30 MAT B = INV(A)\n' +
          '40 PRINT "DET ="; DET\n50 DATA 1,2,2,4\n60 END\n',
      ),
    ).toBe('DET = 0');
  });

  it('simulates a three-dimensional array through a function, as 2.6 does', () => {
    // The manual's closing example: a vector, a DEF of three variables mapping
    // the array's components onto it, and a print-out of two 3-by-5 matrices.
    // Only the six rows are asserted: how many blank lines the two bare PRINTs
    // leave between the halves is not legible in the manual's scanned listing.
    const printed = output(
      '10 DIM V(1000)\n20 MAT READ D(3)\n' +
        '30 DEF FNA(I,J,K) = ((I-1)*D(2)+(J-1))*D(3) + K\n' +
        '50 FOR I = 1 TO D(1)\n60 FOR J = 1 TO D(2)\n70 FOR K = 1 TO D(3)\n' +
        '80 LET V(FNA(I,J,K)) = I+2*J+K↑2\n90 PRINT V(FNA(I,J,K)),\n' +
        '100 NEXT K\n110 NEXT J\n112 PRINT\n115 PRINT\n120 NEXT I\n' +
        '900 DATA 2,3,5\n999 END\n',
    )
      .split('\n')
      .filter((line) => line !== '');
    expect(printed).toEqual([
      zoned(' 4', ' 7', ' 12', ' 19', ' 28'),
      zoned(' 6', ' 9', ' 14', ' 21', ' 30'),
      zoned(' 8', ' 11', ' 16', ' 23', ' 32'),
      zoned(' 5', ' 8', ' 13', ' 20', ' 29'),
      zoned(' 7', ' 10', ' 15', ' 22', ' 31'),
      zoned(' 9', ' 12', ' 17', ' 24', ' 33'),
    ]);
  });
});
