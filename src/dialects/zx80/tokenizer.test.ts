import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { NEWLINE } from './charset';

describe('zx80 tokenizer', () => {
  it('stores a line as [lineNo BE][body][NEWLINE] with no length field', () => {
    const { bytes, errors } = tokenizeProgram('10 PRINT 1');
    expect(errors).toEqual([]);
    // line 10 (00 0a), PRINT (0xf4), digit '1' (0x1d), NEWLINE (0x76)
    expect(Array.from(bytes)).toEqual([0x00, 0x0a, 0xf4, 0x1d, NEWLINE]);
  });

  it('stores numbers as plain digit characters (no marker, no float)', () => {
    const { bytes } = tokenizeProgram('20 PRINT 123');
    // 123 -> '1' '2' '3' = 0x1d 0x1e 0x1f, with nothing after them
    expect(Array.from(bytes)).toEqual([
      0x00,
      0x14,
      0xf4,
      0x1d,
      0x1e,
      0x1f,
      NEWLINE,
    ]);
  });

  it('stores operators as tokens, not character codes', () => {
    const { bytes } = tokenizeProgram('10 PRINT 2+3');
    // + must be token 0xDD (a ZX80 stores operators as tokens)
    expect(Array.from(bytes)).toEqual([
      0x00,
      0x0a,
      0xf4,
      0x1e,
      0xdd,
      0x1f,
      NEWLINE,
    ]);
  });

  it('round-trips through the detokenizer', () => {
    const src = '10 LET A=2\n20 PRINT A*A\n30 GOTO 20\n';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    expect(detokenizeProgram(bytes)).toBe(src);
  });

  it('leaves integral functions as letters (no token) and round-trips them', () => {
    // ABS/CHR$ are integral functions with no token: their letters must be
    // stored as character codes, never matched to a keyword token. The letters
    // A,B,S each sit in the letter range (0x26-0x3f), well clear of the keyword
    // token range (0xD5-0xFE), and the whole program round-trips verbatim.
    const src = '10 LET A=ABS(0-7)\n20 PRINT CHR$(38)\n';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    for (const code of [0x26, 0x27, 0x38]) {
      // A, B, S letter codes are present in the stored body…
      expect(Array.from(bytes)).toContain(code);
    }
    expect(detokenizeProgram(bytes)).toBe(src);
  });

  it('rejects numbers outside the integer range', () => {
    const { errors } = tokenizeProgram('10 PRINT 40000');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/out of range/);
  });

  it('flags lines that are not strictly ascending', () => {
    const { errors } = tokenizeProgram('20 PRINT 1\n10 PRINT 2');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/not greater/);
  });

  it('requires a statement keyword at the start of a line', () => {
    const { errors } = tokenizeProgram('10 A=1');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/statement keyword/);
  });

  it('keeps REM text literal', () => {
    const { bytes } = tokenizeProgram('10 REM HI');
    // REM (0xfe) then 'H' 'I' (0x2d 0x2e), NEWLINE
    expect(Array.from(bytes)).toEqual([0x00, 0x0a, 0xfe, 0x2d, 0x2e, NEWLINE]);
  });

  it('handles quoted strings and the quote-image', () => {
    const src = '10 PRINT "HI"\n';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    expect(detokenizeProgram(bytes)).toBe(src);
  });
});
