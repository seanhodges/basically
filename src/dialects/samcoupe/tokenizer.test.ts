import { describe, it, expect } from 'vitest';
import { tokenizeProgram, MAX_LINE_NUMBER } from './tokenizer';
import { samcoupeKeywords, keywordAliases } from './keywords';

const bytesOf = (src: string): number[] =>
  Array.from(tokenizeProgram(src).bytes);
/** One line's body, with the four header bytes and the 0x0D stripped. */
const bodyOf = (src: string): number[] => bytesOf(src).slice(4, -1);

describe('samcoupe keyword table', () => {
  it('has one token per spelling, in the ROM list order', () => {
    const tokens = samcoupeKeywords.map((k) => k.token);
    expect(new Set(tokens).size).toBe(tokens.length);
    expect(new Set(samcoupeKeywords.map((k) => k.word)).size).toBe(
      tokens.length,
    );
    // Every token is either a function code behind the 0xFF leader or a
    // single-byte command; the ROM has nothing in 0x84.
    for (const k of samcoupeKeywords) {
      expect(k.token >= 0x3b && k.token <= 0x83).toBe(k.token < 0x85);
      expect(k.token).not.toBe(0x84);
    }
    // The order the ROM's matcher walks: the first entry that fits wins, so
    // the entries that are prefixes of others must come after them.
    const at = (word: string) =>
      samcoupeKeywords.findIndex((k) => k.word === word);
    expect(at('LOOP IF')).toBeLessThan(at('LOOP'));
    expect(at('ON ERROR')).toBeLessThan(at('ON'));
    expect(at('INSTR')).toBeLessThan(at('IN'));
    expect(keywordAliases).toEqual({ INK: 'PEN' });
  });
});

describe('samcoupe tokenizer', () => {
  it('frames a line the way INSERTLN does', () => {
    // Line number big-endian, then a little-endian length covering the body
    // and its own 0x0D terminator.
    expect(bytesOf('10 CLS')).toEqual([0x00, 0x0a, 0x02, 0x00, 0x9f, 0x0d]);
    expect(bytesOf('300 CLS').slice(0, 2)).toEqual([0x01, 0x2c]);
    expect(tokenizeProgram(`${MAX_LINE_NUMBER} CLS`).errors).toEqual([]);
    expect(
      tokenizeProgram(`${MAX_LINE_NUMBER + 1} CLS`).errors[0]?.message,
    ).toContain('out of range');
    expect(tokenizeProgram('20 CLS\n10 CLS').errors[0]?.message).toContain(
      'not greater than',
    );
    expect(tokenizeProgram('CLS').errors[0]?.message).toBe(
      'Missing line number',
    );
    expect(tokenizeProgram('10 PRINT "x').errors[0]?.message).toBe(
      'Unterminated string',
    );
  });

  it('stores commands as one byte and functions behind the 0xFF leader', () => {
    expect(bodyOf('10 PRINT LEN a$')).toEqual([0xbb, 0xff, 0x6b, 0x61, 0x24]);
    expect(bodyOf('10 PALETTE 1,0').slice(0, 1)).toEqual([0xa0]);
    // A keyword swallows one space either side of itself, as TOK43/TOK6 do,
    // and keeps the spaces that are not next to one.
    expect(bodyOf('10 LET a = 1').slice(0, 4)).toEqual([
      0x9c, 0x61, 0x20, 0x3d,
    ]);
    // A keyword's own space is optional in the input.
    expect(bodyOf('10 GOTO 20').slice(0, 1)).toEqual([0xb4]);
    expect(bodyOf('10 GO TO 20').slice(0, 1)).toEqual([0xb4]);
    expect(bodyOf('10 DEFPROC p').slice(0, 1)).toEqual([0xca]);
    // ALDU rejects a keyword followed by a letter, '$' or '_' - but not by a
    // digit, which is why PRINT1 really is PRINT followed by 1 here.
    expect(bodyOf('10 LET printer=1').slice(0, 2)).toEqual([0x9c, 0x70]);
    expect(bodyOf('10 PRINT1').slice(0, 2)).toEqual([0xbb, 0x31]);
    // INK is a spelling of PEN, and stores PEN's token.
    expect(bodyOf('10 INK 2').slice(0, 1)).toEqual([0xa1]);
  });

  it('rewrites IF and ELSE when THEN makes the statement single-line', () => {
    // The ROM tokenizes IF as 0xD7 because it comes first in the list, then
    // its syntax pass forces 0xD8 once a THEN turns up - and an ELSE after a
    // short IF becomes the short 0xDA.
    expect(bodyOf('10 IF a THEN CLS: ELSE CLS')).toEqual([
      0xd8, 0x61, 0x8d, 0x9f, 0x3a, 0xda, 0x9f,
    ]);
    expect(bodyOf('10 IF a')).toEqual([0xd7, 0x61]);
    expect(bodyOf('10 ELSE CLS')).toEqual([0xd9, 0x9f]);
    // Each line starts over: LINESCAN clears the ROM's IFTYPE per line.
    expect(bodyOf('10 IF a THEN CLS\n20 ELSE CLS').slice(-2)).toEqual([
      0xd9, 0x9f,
    ]);
  });

  it('carries a hidden five-byte value after every numeric literal', () => {
    // Digits, the 0x0E marker, then the small-integer form STACKBC builds.
    expect(bodyOf('10 LET a=1000')).toEqual([
      0x9c, 0x61, 0x3d, 0x31, 0x30, 0x30, 0x30, 0x0e, 0x00, 0x00, 0xe8, 0x03,
      0x00,
    ]);
    // A hexadecimal literal takes the same form (CALC5BY -> AMPERSAND).
    expect(bodyOf('10 LET a=&FF00').slice(3)).toEqual([
      0x26, 0x46, 0x46, 0x30, 0x30, 0x0e, 0x00, 0x00, 0x00, 0xff, 0x00,
    ]);
    // BIN's digits carry one too.
    expect(bodyOf('10 LET a=BIN 101').slice(3)).toEqual([
      0xff, 0x43, 0x31, 0x30, 0x31, 0x0e, 0x00, 0x00, 0x05, 0x00, 0x00,
    ]);
    // A fraction takes the floating-point form: exponent biased by 0x80, then
    // a four-byte mantissa whose top bit is the sign.
    expect(bodyOf('10 LET a=0.5').slice(-5)).toEqual([
      0x80, 0x00, 0x00, 0x00, 0x00,
    ]);
  });

  it('reserves a DEF FN parameter slot, and keeps a REM body verbatim', () => {
    // MAKESIX opens six bytes after each parameter name for the argument.
    expect(bodyOf('10 DEF FN f(x,y$)=x')).toEqual([
      0xc8, 0x66, 0x28, 0x78, 0x0e, 0, 0, 0, 0, 0, 0x2c, 0x79, 0x24, 0x0e, 0, 0,
      0, 0, 0, 0x29, 0x3d, 0x78,
    ]);
    // Nothing after REM is tokenized, and only the one space REM itself eats
    // is lost.
    expect(bodyOf('10 REM  PRINT a')).toEqual([
      0xb7, 0x20, 0x50, 0x52, 0x49, 0x4e, 0x54, 0x20, 0x61,
    ]);
    // Nor is anything inside a string.
    expect(bodyOf('10 PRINT "PRINT"')).toEqual([
      0xbb, 0x22, 0x50, 0x52, 0x49, 0x4e, 0x54, 0x22,
    ]);
  });

  it('flags a statement that cannot open one, without blocking the image', () => {
    // A bare name is legal - it calls a DEF PROC - so only an assignment
    // without LET is worth saying anything about.
    expect(tokenizeProgram('10 greet "x"').errors).toEqual([]);
    const assign = tokenizeProgram('10 score=1').errors;
    expect(assign[0]?.message).toContain('needs LET');
    expect(assign[0]?.fatal).toBe(false);
    expect(tokenizeProgram('10 5').errors[0]?.fatal).toBe(false);
    expect(bodyOf('10 5').length).toBeGreaterThan(0);
  });
});
