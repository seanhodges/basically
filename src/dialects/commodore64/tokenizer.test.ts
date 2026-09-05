import { describe, expect, it } from 'vitest';
import { hasFatalErrors } from '../types';
import { tokenizeProgram, type CbmVariant } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { c64KeywordsByLength, type C64Keyword } from './keywords';
import { PET_VARIANT } from '../pet/tokenizer';
import { VIC20_VARIANT } from '../vic20/tokenizer';
import { PROGRAM_BASE } from './addresses';

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

/**
 * The shortest shifted-letter abbreviation that resolves to `word`, worked out
 * from the machine's own table rather than from the tokenizer under test.
 *
 * The ROM's scan takes the first word in reserved-word order (ascending token)
 * that the typed prefix begins, so a keyword whose spelling is a prefix of an
 * earlier one has no abbreviation at all: PRINT is always reached as PRINT#,
 * which is exactly why `?` exists. A prefix that is itself a whole keyword
 * (`GO`) is no abbreviation either - the full spelling of that keyword is what
 * those characters mean.
 */
function shortestAbbreviation(
  word: string,
  keywordsByLength: C64Keyword[],
): string | null {
  const order = keywordsByLength
    .filter((kw) => kw.alias !== true && /^[A-Z]/.test(kw.word))
    .sort((a, b) => a.token - b.token);
  for (let n = 2; n <= word.length; n++) {
    const prefix = word.slice(0, n);
    // A shifted letter ends the abbreviation, so `TAB(`'s `(` and `INPUT#`'s
    // `#` can never be the last character typed.
    if (!/^[A-Z]+$/.test(prefix)) break;
    if (keywordsByLength.some((kw) => kw.word === prefix)) continue;
    const first = order.find((kw) => kw.word.startsWith(prefix));
    if (first?.word === word) {
      return prefix.slice(0, -1).toLowerCase() + prefix[n - 1];
    }
  }
  return null;
}

/** The tokenized body of a one-line program, less link, line number and terminator. */
function bodyBytes(source: string, variant?: CbmVariant): number[] {
  return Array.from(tokenizeProgram(source, variant).program.slice(4, -3));
}

const C64_VARIANT: CbmVariant = {
  progStart: PROGRAM_BASE,
  keywordsByLength: c64KeywordsByLength,
};

describe.each([
  ['C64', C64_VARIANT],
  ['PET', PET_VARIANT],
  ['VIC-20', VIC20_VARIANT],
])('%s shifted-letter abbreviations', (_name, variant) => {
  const table = variant.keywordsByLength;

  it('tokenizes every keyword through its shortest abbreviation', () => {
    const abbreviated = table.filter(
      (kw) => kw.alias !== true && /^[A-Z]/.test(kw.word),
    );
    expect(abbreviated.length).toBeGreaterThan(50);
    for (const kw of abbreviated) {
      const short = shortestAbbreviation(kw.word, table);
      if (short === null) continue;
      expect(bodyBytes(`10 ${short}\n`, variant)[0], `${short} -> ${kw.word}`) //
        .toBe(kw.token);
    }
  });

  it('resolves a tie to the first word in reserved-word order', () => {
    // `poS` begins POS alone but `pO` begins POKE and POS; `goT` begins GOTO
    // and `goS` GOSUB. Each takes the lowest token, which is what a magazine
    // listing means by it.
    expect(bodyBytes('10 pO53280,0\n', variant)[0]).toBe(0x97); // POKE, not POS
    expect(bodyBytes('10 A=poS(0)\n', variant)[2]).toBe(0xb9); // POS
    expect(bodyBytes('10 goT100\n', variant)[0]).toBe(0x89); // GOTO
    expect(bodyBytes('10 goS100\n', variant)[0]).toBe(0x8d); // GOSUB, not GO
  });

  it('keeps a two-letter keyword as itself where it is the whole spelling', () => {
    // `gO` is GO written out, not an abbreviation of GOTO: the full spelling
    // reaches exactly as far, and a full spelling always wins a tie. Reaching
    // GOTO takes one more letter.
    expect(bodyBytes('10 gO TO 100\n', variant)[0]).toBe(0xcb); // GO
  });

  it('has no abbreviation for a keyword an earlier one is a prefix of', () => {
    // PRINT is reached as PRINT#, INPUT as INPUT#, GO as GOTO: on the real
    // machines these three simply cannot be abbreviated.
    expect(shortestAbbreviation('PRINT', table)).toBeNull();
    expect(shortestAbbreviation('INPUT', table)).toBeNull();
    expect(shortestAbbreviation('GO', table)).toBeNull();
    expect(bodyBytes('10 pR"HI"\n', variant)[0]).toBe(0x98); // PRINT#
  });

  it('accepts the {shift-x} escape spelling of the shifted letter', () => {
    expect(bodyBytes('10 p{shift-o}53280,0\n', variant)).toEqual(
      bodyBytes('10 pO53280,0\n', variant),
    );
  });

  it('leaves full spellings alone in every mix of case', () => {
    const upper = '10 PRINT"HI":FOR I=1 TO 5:NEXT:INPUT A$\n';
    const mixed = '10 Print"HI":For I=1 To 5:Next:Input A$\n';
    const lower = '10 print"HI":for I=1 to 5:next:input A$\n';
    expect(bodyBytes(mixed, variant)).toEqual(bodyBytes(upper, variant));
    expect(bodyBytes(lower, variant)).toEqual(bodyBytes(upper, variant));
  });

  it('does not read an abbreviation inside a string, REM tail or DATA', () => {
    expect(bodyBytes('10 PRINT"pO53280"\n', variant)).not.toContain(0x97);
    expect(bodyBytes('10 REM pO53280\n', variant)).not.toContain(0x97);
    expect(bodyBytes('10 DATA pO,1\n', variant)).not.toContain(0x97);
  });

  it('reads a mixed-case name as the keyword it abbreviates', () => {
    // The trade this notation costs, chosen rather than discovered: a variable
    // spelled `pO` becomes POKE, exactly as it would on the real machine.
    expect(bodyBytes('10 pO=1\n', variant)).toContain(0x97);
    // A lower-case name is untouched, and so is one whose letters begin no
    // keyword - most mixed-case names are simply names.
    expect(bodyBytes('10 po=1\n', variant)).not.toContain(0x97);
    expect(bodyBytes('10 xQ=1\n', variant)).toEqual(
      bodyBytes('10 XQ=1\n', variant),
    );
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
