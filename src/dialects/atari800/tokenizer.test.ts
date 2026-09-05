// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram, detokenizeWithReport } from './detokenizer';
import { isAtariImage, parseAtariImage, TOKEN_BUFFER_BYTES } from './basfile';
import { ATARI_TOKENS } from './keywords';

/** Tokenize, then list back - what a save/load round trip does to a program. */
function roundTrip(source: string): string {
  const { image, errors } = tokenizeProgram(source);
  expect(errors.filter((e) => e.fatal !== false)).toEqual([]);
  return detokenizeProgram(image);
}

/** The tokens of the one statement on the one line of `source`. */
function statementBytes(source: string): number[] {
  const { image } = tokenizeProgram(source);
  const parsed = parseAtariImage(image);
  return [...(parsed.lines[0]!.statements[0] ?? [])];
}

describe('Atari BASIC tokenizer', () => {
  it('round-trips a program through tokenize and list', () => {
    const source = [
      '10 REM CIRCLES',
      '20 GRAPHICS 8',
      '30 FOR I=1 TO 10 STEP 2',
      '40 PRINT "HI ";I',
      '50 NEXT I',
      '60 DIM B(10),C$(20)',
      '70 X=INT(RND(0)*10)+1',
      '80 IF C$="Y" THEN 30',
      '90 ON X GOTO 20,30',
      '100 PRINT #6;X',
      '110 POKE 752,1:SOUND 0,121,10,8',
      '120 A$(1,3)="ABC"',
      '130 END',
    ].join('\n');
    expect(roundTrip(source)).toBe(source);
  });

  it('keeps a colon-separated line as two statements', () => {
    const { image } = tokenizeProgram('10 PRINT "A":PRINT "B"');
    expect(parseAtariImage(image).lines[0]!.statements).toHaveLength(2);
    expect(detokenizeProgram(image)).toBe('10 PRINT "A":PRINT "B"');
  });

  // `IF … THEN <statement>` is two statements in the image: THEN closes the IF,
  // and what follows gets a record of its own. `THEN <line>` stays one.
  it('splits IF … THEN <statement> but not IF … THEN <line>', () => {
    const branch = tokenizeProgram('10 IF X=1 THEN PRINT "Y"');
    expect(parseAtariImage(branch.image).lines[0]!.statements).toHaveLength(2);
    expect(detokenizeProgram(branch.image)).toBe('10 IF X=1 THEN PRINT "Y"');

    const jump = tokenizeProgram('10 IF X=1 THEN 99');
    expect(parseAtariImage(jump.image).lines[0]!.statements).toHaveLength(1);
  });

  describe('the token a spelling gets depends on the parse', () => {
    it('writes = as assignment, numeric comparison or string comparison', () => {
      expect(statementBytes('10 X=1')).toContain(ATARI_TOKENS.IMPLIED_LET);
      expect(statementBytes('10 X=1')).toContain(0x2d);
      expect(statementBytes('10 A$="Y"')).toContain(0x2e);
      expect(statementBytes('10 IF X=1 THEN 20')).toContain(0x22);
      expect(statementBytes('10 IF A$="Y" THEN 20')).toContain(0x34);
    });

    it('writes ( as a group, a function, a subscript or a dimension', () => {
      expect(statementBytes('10 X=(1)')).toContain(0x2b);
      expect(statementBytes('10 X=ABS(1)')).toContain(0x3a);
      expect(statementBytes('10 X=B(1)')).toContain(0x38);
      expect(statementBytes('10 X=C$(1)')).toContain(0x37);
      expect(statementBytes('10 DIM B(1)')).toContain(0x39);
      expect(statementBytes('10 DIM C$(1)')).toContain(0x3b);
    });

    it('writes a comma inside a subscript differently from one outside', () => {
      expect(statementBytes('10 X=B(1,2)')).toContain(0x3c);
      expect(statementBytes('10 PRINT 1,2')).toContain(0x12);
    });

    it('writes a leading minus as unary, but folds one into a constant', () => {
      // A sign touching a number is part of the number: `-1` is one negative
      // constant, not a positive one behind an operator. A sign in front of
      // anything else - a variable, or a number it is not touching - is the
      // unary operator. Checked against the ROM in `tokenizerRom.test.ts`.
      const bcd = (source: string) => [...statementBytes(source).slice(-8, -1)];
      expect(bcd('10 X=-1')).toEqual([0x0e, 0xc0, 0x01, 0, 0, 0, 0]);
      expect(bcd('10 X=1')).toEqual([0x0e, 0x40, 0x01, 0, 0, 0, 0]);
      // $36 in the expression space is the unary minus (and, confusingly, the
      // implied LET in the statement space, which is why these look for it past
      // the statement token every one of these lines opens with).
      expect(statementBytes('10 X=-Y').slice(1)).toContain(0x36);
      expect(statementBytes('10 X=- 1').slice(1)).toContain(0x36);
      expect(statementBytes('10 X=2-1')).toContain(0x26);
    });
  });

  describe('the variable tables', () => {
    it('gives A, A$ and A( three entries of their own', () => {
      const { image } = tokenizeProgram('10 A=1\n20 A$="X"\n30 DIM A(2)');
      expect(parseAtariImage(image).variables).toEqual([
        { name: 'A', kind: 'number' },
        { name: 'A', kind: 'string' },
        { name: 'A', kind: 'array' },
      ]);
    });

    it('interns a repeated name once', () => {
      const { image } = tokenizeProgram('10 SCORE=1\n20 SCORE=SCORE+1');
      expect(parseAtariImage(image).variables).toEqual([
        { name: 'SCORE', kind: 'number' },
      ]);
    });

    it('reports a program that needs more than 128 variables', () => {
      const lines = Array.from(
        { length: 130 },
        (_, i) => `${(i + 1) * 10} V${i}=1`,
      );
      const { errors } = tokenizeProgram(lines.join('\n'));
      expect(errors.some((e) => e.message.includes('at most 128'))).toBe(true);
    });
  });

  // The ROM matches its reserved-word table before it looks for a name, so a
  // name that opens with a keyword is not the name its author meant.
  it('lets a reserved word win over a name that starts with one', () => {
    const { image } = tokenizeProgram('10 LETTER=1');
    expect(parseAtariImage(image).variables).toEqual([
      { name: 'TER', kind: 'number' },
    ]);
    expect(detokenizeProgram(image)).toBe('10 LET TER=1');
  });

  describe('line numbers', () => {
    it('requires one on every line', () => {
      const { errors } = tokenizeProgram('PRINT "HI"');
      expect(errors[0]!.message).toContain('line number');
    });

    it('rejects one above 32767', () => {
      expect(tokenizeProgram('40000 END').errors[0]!.message).toContain(
        '0 to 32767',
      );
    });

    it('ignores blank lines', () => {
      const { image } = tokenizeProgram('10 END\n\n20 END\n');
      // The immediate-mode line sits past STMCUR, so it is not one of these.
      expect(parseAtariImage(image).lines).toHaveLength(2);
    });
  });

  describe('the image', () => {
    it('opens with a zero LOMEM word and the token buffer gap', () => {
      const { image } = tokenizeProgram('10 END');
      expect(image[0]).toBe(0);
      expect(image[1]).toBe(0);
      expect(parseAtariImage(image).header.vntp).toBe(TOKEN_BUFFER_BYTES);
      expect(isAtariImage(image)).toBe(true);
    });

    it('keeps every header pointer in ascending order', () => {
      const { image } = tokenizeProgram('10 A$="X"\n20 PRINT A$');
      const { header } = parseAtariImage(image);
      const pointers = [
        header.vntp,
        header.vntd,
        header.vvtp,
        header.stmtab,
        header.stmcur,
        header.starp,
      ];
      expect([...pointers].sort((a, b) => a - b)).toEqual(pointers);
      // The saved block is everything from VNTP to STARP, behind the header.
      expect(image.length).toBe(14 + header.starp - header.vntp);
    });

    it('is not mistaken for a plain listing', () => {
      expect(isAtariImage(new TextEncoder().encode('10 PRINT "HI"'))).toBe(
        false,
      );
      expect(detokenizeWithReport(new Uint8Array(4)).warnings).toHaveLength(1);
    });
  });

  describe('REM and DATA', () => {
    it('stores the rest of the line as an ATASCII record', () => {
      // Not a statement with tokens in it: the text runs to an end-of-line
      // rather than to a statement terminator, and the blank that separated it
      // from the keyword is the separator rather than part of it.
      const rem = statementBytes('10 REM A:B"C');
      expect(rem[0]).toBe(0x00);
      expect(rem).not.toContain(ATARI_TOKENS.END_OF_STATEMENT);
      expect(rem.at(-1)).toBe(0x9b);
      expect(rem[1]).toBe('A'.charCodeAt(0));
      expect(detokenizeProgram(tokenizeProgram('10 REM A:B"C').image)).toBe(
        '10 REM A:B"C',
      );
    });

    it('keeps an empty REM empty', () => {
      expect(statementBytes('10 REM')).toEqual([0x00, 0x9b]);
      expect(roundTrip('10 REM')).toBe('10 REM');
    });

    it('keeps a colon inside DATA as data', () => {
      expect(roundTrip('10 DATA 1,2,3')).toBe('10 DATA 1,2,3');
    });
  });

  // Only where the run *is* the word: `int1` is a name someone chose, and
  // reading it as a lower-case INT would change a program that works.
  it('leaves a name that merely opens with a lower-case keyword alone', () => {
    const { errors, image } = tokenizeProgram('10 X=int1');
    expect(errors).toEqual([]);
    expect(parseAtariImage(image).variables).toEqual([
      { name: 'X', kind: 'number' },
      { name: 'INT1', kind: 'number' },
    ]);
  });

  it('reports a lower-case keyword without refusing the program', () => {
    const { errors, image } = tokenizeProgram('10 print "HI"');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.fatal).toBe(false);
    expect(errors[0]!.message).toContain('Lower-case keyword');
    expect(detokenizeProgram(image)).toBe('10 PRINT "HI"');
  });

  it('stores numeric constants as Atari floats', () => {
    const bytes = statementBytes('10 X=0.5');
    const at = bytes.indexOf(ATARI_TOKENS.NUMERIC_CONSTANT);
    expect(bytes.slice(at, at + 7)).toEqual([0x0e, 0x3f, 0x50, 0, 0, 0, 0]);
  });
});
