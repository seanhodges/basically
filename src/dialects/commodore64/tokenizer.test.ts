import { describe, expect, it } from 'vitest';
import { hasFatalErrors } from '../types';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';

describe('C64 tokenizer', () => {
  it('produces the $0801 linked-line layout for 10 PRINT "HI"', () => {
    const { program, errors } = tokenizeProgram('10 PRINT "HI"\n');
    expect(errors).toEqual([]);
    // link ($080d), line 10, PRINT, space, "HI", 0x00, then 0x0000 end.
    expect(Array.from(program)).toEqual([
      0x0c,
      0x08, // link to next line ($080c)
      0x0a,
      0x00, // line number 10
      0x99, // PRINT
      0x20, // space
      0x22,
      0x48,
      0x49,
      0x22, // "HI"
      0x00, // end of line
      0x00,
      0x00, // end of program
    ]);
  });

  it('tokenizes greedily and position-independently (FORI=1TO5)', () => {
    const { program } = tokenizeProgram('10 FORI=1TO5\n');
    // FOR(0x81) I = 1 TO(0xa4) 5 ; '=' is operator token 0xb2
    const body = Array.from(program.slice(4, -3));
    expect(body).toEqual([0x81, 0x49, 0xb2, 0x31, 0xa4, 0x35]);
  });

  it('keeps REM and DATA text verbatim', () => {
    const rem = tokenizeProgram('10 REM PRINT NOT TOKENIZED\n').program;
    // After REM (0x8f) nothing else should tokenize: no PRINT (0x99) byte.
    expect(Array.from(rem)).not.toContain(0x99);
    const data = tokenizeProgram('10 DATA PRINT,1\n').program;
    expect(Array.from(data)).not.toContain(0x99);
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

  it('detokenizes a full .prg (with load address)', () => {
    const { program } = tokenizeProgram('10 PRINT "HI"\n');
    const prg = Uint8Array.from([0x01, 0x08, ...program]);
    expect(detokenizeProgram(prg)).toBe('10 PRINT "HI"\n');
  });
});

describe('C64 tokenizer statement validation', () => {
  it('flags a misspelled keyword at the start of a statement', () => {
    const { errors } = tokenizeProgram('10 PRNT "HI"\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.line).toBe(1);
    expect(errors[0]!.message).toMatch(/must start with/i);
  });

  it('flags a bad statement after a colon', () => {
    const { errors } = tokenizeProgram('10 A=1:PRNT 2\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/PRNT/);
  });

  it('flags a function keyword used as a statement', () => {
    const { errors } = tokenizeProgram('10 SIN(3)\n');
    expect(errors).toHaveLength(1);
  });

  it('accepts implied-LET assignments, arrays and TI$', () => {
    const src = [
      '10 A=1:B$="X":A(3)=4',
      '20 TI$="000000"',
      '30 IF A=1 THEN A=2',
      '40 IFA=1THEN100',
    ].join('\n');
    expect(tokenizeProgram(src).errors).toEqual([]);
  });

  it('tokenizes the ? shorthand as PRINT, like the ROM cruncher', () => {
    const { program, errors } = tokenizeProgram('10 ?"HI"\n');
    expect(errors).toEqual([]);
    const body = Array.from(program.slice(4, -3));
    expect(body[0]).toBe(0x99); // PRINT token, not a literal '?'
  });

  it('accepts ^ as the ↑ power operator ($AE)', () => {
    const { program, errors } = tokenizeProgram('10 A=2^3\n');
    expect(errors).toEqual([]);
    expect(Array.from(program)).toContain(0xae);
    // ↑ and ^ tokenize identically; LIST spells the canonical ↑.
    const caret = tokenizeProgram('10 A=2^3\n').program;
    const arrow = tokenizeProgram('10 A=2↑3\n').program;
    expect(Array.from(caret)).toEqual(Array.from(arrow));
    expect(detokenizeProgram(caret)).toBe('10 A=2↑3\n');
  });
});

describe('C64 tokenizer line-number leniency', () => {
  it('warns but still builds a line number above 63999 (non-fatal)', () => {
    const { errors } = tokenizeProgram('64000 PRINT 1\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.fatal).toBe(false);
    expect(hasFatalErrors(errors)).toBe(false);
  });

  it('keeps a > 63999 line in the image so imports stay runnable', () => {
    const { program } = tokenizeProgram('64000 PRINT\n');
    // line number 64000 = $FA00, stored little-endian after the link.
    expect(Array.from(program.slice(2, 4))).toEqual([0x00, 0xfa]);
    expect(detokenizeProgram(program)).toBe('64000 PRINT\n');
  });

  it('still rejects a line number past the 16-bit maximum (fatal)', () => {
    const { errors } = tokenizeProgram('70000 PRINT\n');
    expect(errors).toHaveLength(1);
    expect(hasFatalErrors(errors)).toBe(true);
  });

  it('makes non-ascending line numbers a non-fatal warning', () => {
    const { errors } = tokenizeProgram('20 PRINT 1\n10 PRINT 2\n');
    const order = errors.find((e) => /not greater/.test(e.message))!;
    expect(order.fatal).toBe(false);
    expect(hasFatalErrors(errors)).toBe(false);
  });
});
