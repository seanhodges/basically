import { describe, expect, it } from 'vitest';
import { hasFatalErrors } from '../types';
import { detokenizeProgram } from './detokenizer';
import { tokenizeProgram } from './tokenizer';

/**
 * Pin the tokenizer against what the interpreter itself stores.
 *
 * Every byte string in {@link STORED} was captured from the shipped firmware:
 * `public/roms/apple1.rom` was booted on the vendored 6502 core, driven through
 * WozMon into Integer BASIC with `E000R`, fed the line on the left through the
 * keyboard PIA and then dumped between the zero-page pointers PP and HIMEM. So
 * these are not expectations about how the tokenizer ought to behave - they are
 * the machine's own answer, and a change that breaks one is a change that stops
 * agreeing with the ROM.
 *
 * The reason the list is this long is that the token a keyword gets depends on
 * the grammar rule that matched it: `PRINT` has three bytes, `,` has eight and
 * `(` six. There is no shortcut that covers them.
 */
const STORED: [string, string][] = [
  // Assignment, constants and the two `=` tokens.
  ['10 A=1', '09 0a 00 c1 71 b1 01 00 01'],
  ['10 A1=3', '0a 0a 00 c1 b1 71 b3 03 00 01'],
  ['10 A$="X"', '0a 0a 00 c1 40 70 28 d8 29 01'],
  ['10 A$=B$', '09 0a 00 c1 40 70 c2 40 01'],
  // The introducing byte of a constant is the ASCII of its first digit, so a
  // leading zero really does change the stored bytes.
  ['10 A=007', '09 0a 00 c1 71 b0 07 00 01'],
  ['10 A=0', '09 0a 00 c1 71 b0 00 00 01'],
  ['10 A=32767', '09 0a 00 c1 71 b3 ff 7f 01'],
  ['10 LET A=1', '0a 0a 00 5e c1 71 b1 01 00 01'],

  // PRINT: the keyword names the first item's type, each separator the next.
  ['10 PRINT', '05 0a 00 63 01'],
  ['10 PRINT "HI"', '09 0a 00 61 28 c8 c9 29 01'],
  ['10 PRINT A,B;C', '0a 0a 00 62 c1 49 c2 46 c3 01'],
  ['10 PRINT "A";B', '0a 0a 00 61 28 c1 29 46 c2 01'],
  ['10 PRINT B;"A"', '0a 0a 00 62 c2 45 28 c1 29 01'],
  ['10 PRINT B,"A"', '0a 0a 00 62 c2 48 28 c1 29 01'],
  ['10 PRINT A;', '07 0a 00 62 c1 47 01'],
  ['10 PRINT -1', '09 0a 00 62 36 b1 01 00 01'],

  // IF: `THEN <line>` and `THEN <statement>` are different tokens.
  ['10 IF A>1 THEN 10', '0e 0a 00 60 c1 19 b1 01 00 24 b1 0a 00 01'],
  ['10 IF A>1 THEN PRINT A', '0d 0a 00 60 c1 19 b1 01 00 25 62 c1 01'],
  ['10 IF A THEN GOTO 10', '0b 0a 00 60 c1 25 5f b1 0a 00 01'],
  ['10 IF C$="X" THEN END', '0d 0a 00 60 c3 40 39 28 d8 29 25 51 01'],
  ['10 IF A$#"X" THEN 10', '0f 0a 00 60 c1 40 3a 28 d8 29 24 b1 0a 00 01'],
  ['10 IF A<=1 THEN 10', '0e 0a 00 60 c1 1a b1 01 00 24 b1 0a 00 01'],
  ['10 IF A>=1 THEN 10', '0e 0a 00 60 c1 18 b1 01 00 24 b1 0a 00 01'],
  ['10 IF A<>1 THEN 10', '0e 0a 00 60 c1 1b b1 01 00 24 b1 0a 00 01'],
  ['10 IF A#1 THEN 10', '0e 0a 00 60 c1 17 b1 01 00 24 b1 0a 00 01'],

  // Loops.
  [
    '10 FOR I=1 TO 10 STEP 2',
    '12 0a 00 55 c9 56 b1 01 00 57 b1 0a 00 58 b2 02 00 01',
  ],
  ['10 NEXT I', '06 0a 00 59 c9 01'],
  ['10 NEXT I,J', '08 0a 00 59 c9 5a ca 01'],
  ['10 GOTO 10', '08 0a 00 5f b1 0a 00 01'],
  ['10 GOSUB 40', '08 0a 00 5c b4 28 00 01'],
  ['10 RETURN', '05 0a 00 5b 01'],

  // Arrays, strings and their five different parentheses.
  [
    '10 DIM B(10),C$(20)',
    '13 0a 00 4f c2 34 b1 0a 00 72 43 c3 40 22 b2 14 00 72 01',
  ],
  [
    '10 DIM A$(5),B(3)',
    '13 0a 00 4e c1 40 22 b5 05 00 72 44 c2 34 b3 03 00 72 01',
  ],
  ['10 A=B(1)+2', '10 0a 00 c1 71 c2 2d b1 01 00 72 12 b2 02 00 01'],
  ['10 PRINT A$(2)', '0c 0a 00 61 c1 40 2a b2 02 00 72 01'],
  ['10 PRINT C$(1,2)', '10 0a 00 61 c3 40 2a b1 01 00 23 b2 02 00 72 01'],
  ['10 C$(1)="Q"', '0f 0a 00 c3 40 42 b1 01 00 72 70 28 d1 29 01'],

  // Functions. LEN carries its own opening parenthesis in one token.
  ['10 PRINT LEN(C$)', '09 0a 00 62 3b c3 40 72 01'],
  [
    '10 B(2)=PEEK(-16384)',
    '12 0a 00 c2 2d b2 02 00 72 71 2e 3f 36 b1 00 40 72 01',
  ],
  [
    '10 A=RND(6)+ABS(-2)+SGN(3)',
    '1b 0a 00 c1 71 2f 3f b6 06 00 72 12 31 3f 36 b2 02 00 72 12 30 3f b3 03 00 72 01',
  ],

  // Statements with their own operand shapes.
  ['10 POKE 100,7', '0c 0a 00 64 b1 64 00 65 b7 07 00 01'],
  ['10 CALL -936', '09 0a 00 4d 36 b9 a8 03 01'],
  ['10 TAB 5', '08 0a 00 50 b5 05 00 01'],
  ['10 INPUT A,B', '08 0a 00 54 c1 27 c2 01'],
  ['10 INPUT A$', '07 0a 00 52 c1 40 01'],
  ['10 INPUT "NAME",C$', '0e 0a 00 53 28 ce c1 cd c5 29 26 c3 40 01'],
  ['10 END', '05 0a 00 51 01'],

  // Operators, in source order: precedence is the interpreter's job at run time.
  [
    '10 A=-(1+2)*3 MOD 4',
    '18 0a 00 c1 71 36 38 b1 01 00 12 b2 02 00 72 14 b3 03 00 1f b4 04 00 01',
  ],
  [
    '10 A=NOT 1 AND 2 OR 3',
    '12 0a 00 c1 71 37 b1 01 00 1d b2 02 00 1e b3 03 00 01',
  ],
  ['10 A=((1))', '0d 0a 00 c1 71 38 38 b1 01 00 72 72 01'],

  // Statement separator, and REM's verbatim tail.
  ['10 A=A+1: PRINT A', '0e 0a 00 c1 71 c1 12 b1 01 00 03 62 c1 01'],
  ['10 END:REM X', '09 0a 00 51 03 5d a0 d8 01'],
  ['10 REM HELLO :X', '0e 0a 00 5d a0 c8 c5 cc cc cf a0 ba d8 01'],
  ['10 REM', '05 0a 00 5d 01'],

  // Crunching: the entry parser skips spaces outside literals.
  ['10 FORI=1TO10', '0e 0a 00 55 c9 56 b1 01 00 57 b1 0a 00 01'],
  ['10 GOSUB10', '08 0a 00 5c b1 0a 00 01'],

  // The line-number extremes the interpreter accepts.
  ['0 END', '05 00 00 51 01'],
  ['32767 END', '05 ff 7f 51 01'],
];

const hex = (bytes: Uint8Array): string =>
  [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' ');

describe('apple1 tokenizer', () => {
  it.each(STORED)('stores %s the way the interpreter does', (src, bytes) => {
    const { program, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    expect(hex(program)).toBe(bytes);
  });

  it('round-trips every stored line through LIST', () => {
    // The interpreter tokenizes on entry, so the stored form *is* what LIST
    // prints - which makes the listing a fixed point rather than an
    // approximation. (The source is not: `A=007` lists as `A=7` here exactly as
    // it does on the machine, because only the value is stored.)
    for (const [src] of STORED) {
      const first = tokenizeProgram(src).program;
      const listed = detokenizeProgram(first);
      const again = tokenizeProgram(listed);
      expect(again.errors).toEqual([]);
      expect(detokenizeProgram(again.program)).toBe(listed);
    }
  });

  it('lays out several lines in ascending order with no link field', () => {
    const { program, errors } = tokenizeProgram('10 A=1\n20 PRINT A');
    expect(errors).toEqual([]);
    // Two complete records back to back; the program's extent is the gap
    // between PP and HIMEM, so there is nothing to terminate it.
    expect(hex(program)).toBe('09 0a 00 c1 71 b1 01 00 01 06 14 00 62 c1 01');
  });

  it('folds lower case, because the machine has no lower case at all', () => {
    expect(hex(tokenizeProgram('10 print "hi"').program)).toBe(
      hex(tokenizeProgram('10 PRINT "HI"').program),
    );
  });

  describe('refuses what the interpreter refuses', () => {
    const REJECTED: [string, string][] = [
      // A name is one letter and at most one digit. Read off the machine:
      // each of these answers *** SYNTAX ERR.
      ['10 AB=2', 'one letter'],
      ['10 ABC=4', 'one letter'],
      ['10 A12=1', 'one letter'],
      ['10 A1$="X"', 'one letter'],
      // TAB is a statement, not a function.
      ['10 PRINT TAB(5)', 'TAB is a statement'],
      ['10 A=TAB 5', 'TAB is a statement'],
      // A function's argument must be parenthesised.
      ['10 A=PEEK 5', 'PEEK('],
      // Only one dimension, and only one index on an assignment's left side.
      ['10 DIM Z(2,3)', 'closing parenthesis'],
      ['10 A$(1,2)="Q"', 'closing parenthesis'],
      // One unary operator only.
      ['10 A=- -1', 'one unary operator'],
      ['10 A=NOT NOT 1', 'one unary operator'],
      // A trailing comma has no token; a trailing semicolon does.
      ['10 PRINT "X",', 'Expected an expression'],
      // Direct-mode commands are refused inside a numbered line.
      ['10 CLR', 'direct-mode command'],
      ['10 HIMEM=4096', 'direct-mode command'],
      ['10 SCR', 'direct-mode command'],
      // Words in the syntax table that the machine cannot execute.
      ['10 A=USR(1)', 'handler address is $0000'],
      ['10 PRINT HIMEM', 'reads as 0'],
      ['10 PLOT 1,2', 'no graphics hardware'],
      // ^ crunches to token 0x20 and reaches no handler: typed at the machine,
      // `10 A=B^2` stores and lists back, and running it prints the line before
      // it and then nothing at all - the interpreter never comes back.
      ['10 A=B^2', 'no power operator'],
      // Over the interpreter's own integer limit.
      ['10 A=32768', 'over 32767'],
      ['32768 END', 'out of range'],
    ];

    it.each(REJECTED)('refuses %s', (src, fragment) => {
      const { errors } = tokenizeProgram(src);
      expect(hasFatalErrors(errors)).toBe(true);
      expect(errors.map((e) => e.message).join(' | ')).toContain(fragment);
    });
  });

  it('flags a line number that does not climb, without losing the line', () => {
    const { program, errors } = tokenizeProgram('20 A=1\n10 A=2');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.fatal).toBe(false);
    expect(hasFatalErrors(errors)).toBe(false);
    expect(program.length).toBeGreaterThan(0);
  });

  it('refuses a line that would not fit the interpreter length byte', () => {
    const long = `10 REM ${'X'.repeat(300)}`;
    const { errors } = tokenizeProgram(long);
    expect(errors.map((e) => e.message).join()).toContain('at most 255');
  });

  it('reports a character the 2513 cannot draw', () => {
    const { errors } = tokenizeProgram('10 PRINT "café"');
    expect(errors.map((e) => e.message).join()).toContain(
      'no Apple I equivalent',
    );
  });

  it('stores nothing for a bare line number', () => {
    expect(tokenizeProgram('10\n').program).toHaveLength(0);
  });
});
