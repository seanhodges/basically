import { describe, expect, it } from 'vitest';
import { tokenizeProgram, PROG_START } from './tokenizer';
import { detokenizeProgram } from './detokenizer';

describe('trs80 tokenizer', () => {
  it('produces the linked-line layout based at 0x42E8 for 10 PRINT "HI"', () => {
    const { program, errors } = tokenizeProgram('10 PRINT "HI"\n');
    expect(errors).toEqual([]);
    // body = PRINT 0xb2, space, "HI", = 6 bytes; record = 2+2+6+1 = 11 bytes.
    const next = PROG_START + 11; // 0x42f3
    expect(Array.from(program)).toEqual([
      next & 0xff,
      next >> 8, // link to the next line
      0x0a,
      0x00, // line number 10
      0xb2, // PRINT
      0x20, // space
      0x22,
      0x48,
      0x49,
      0x22, // "HI"
      0x00, // end of line
      0x00,
      0x00, // null link: end of program
    ]);
  });

  it('tokenizes greedily and position-independently (FORI=1TO5)', () => {
    const { program } = tokenizeProgram('10 FORI=1TO5\n');
    // FOR(0x81) I '='(0xd5) 1 TO(0xbd) 5
    const body = Array.from(program.slice(4, -3));
    expect(body).toEqual([0x81, 0x49, 0xd5, 0x31, 0xbd, 0x35]);
  });

  it('keeps the longest match: DEFSTR beats DEF, INPUT beats INP', () => {
    expect(Array.from(tokenizeProgram('10 DEFSTRA\n').program.slice(4, -3)))
      // DEFSTR(0x98) A
      .toEqual([0x98, 0x41]);
    expect(Array.from(tokenizeProgram('10 INPUTA\n').program.slice(4, -3)))
      // INPUT(0x89) A
      .toEqual([0x89, 0x41]);
  });

  it('expands the ? and ’ abbreviations to PRINT and REM', () => {
    const q = tokenizeProgram('10 ?"HI"\n').program;
    expect(q[4]).toBe(0xb2); // ? -> PRINT token
    const apostrophe = tokenizeProgram("10 'NOTE\n").program;
    expect(apostrophe[4]).toBe(0x93); // ' -> REM token
  });

  it('keeps REM and DATA text verbatim', () => {
    const rem = tokenizeProgram('10 REM PRINT NOT TOKENIZED\n').program;
    // After REM (0x93) nothing else should tokenize: no PRINT (0xb2) byte.
    expect(Array.from(rem)).not.toContain(0xb2);
    const data = tokenizeProgram('10 DATA PRINT,1\n').program;
    expect(Array.from(data)).not.toContain(0xb2);
  });

  it('allows multi-statement lines separated by colons', () => {
    const { program, errors } = tokenizeProgram('10 CLS:PRINT"HI"\n');
    expect(errors).toEqual([]);
    // CLS(0x84) ':' PRINT(0xb2) "HI"
    expect(Array.from(program.slice(4, 8))).toEqual([0x84, 0x3a, 0xb2, 0x22]);
  });

  it('flags a missing line number with the editor line', () => {
    const { errors } = tokenizeProgram('PRINT 1\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.line).toBe(1);
  });

  it('flags non-ascending line numbers', () => {
    const { errors } = tokenizeProgram('20 PRINT 1\n10 PRINT 2\n');
    expect(errors.some((e) => /not greater/.test(e.message))).toBe(true);
  });

  it('round-trips through the detokenizer', () => {
    const src = '10 PRINT "HI"\n20 FOR I=1 TO 10\n30 NEXT I\n';
    const { program, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    expect(detokenizeProgram(program)).toBe(src);
  });

  it('does not expand keyword bytes inside string literals', () => {
    // Round-trip a string holding a block-graphics character whose code (0x81)
    // collides with the FOR token: it must come back as the glyph, not FOR.
    const glyph = '\u{1FB00}'; // sextant -> code 0x81 (FOR token value)
    const src = `10 PRINT "${glyph}"\n`;
    const { program } = tokenizeProgram(src);
    expect(detokenizeProgram(program)).toBe(src);
  });
});
