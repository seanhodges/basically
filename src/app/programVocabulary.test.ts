import { describe, expect, it } from 'vitest';
import { programVocabulary } from './programVocabulary';
import { getDialect } from '../dialects/registry';

const c64 = getDialect('commodore64');
const bbc = getDialect('bbcmicro');
const spectrum = getDialect('zxspectrum');
const zx81 = getDialect('zx81');

describe('programVocabulary - keywords', () => {
  it('splits crunched entry the way the ROM does', () => {
    // The C64 ROM ignores spaces outside strings/REM, so this is a real
    // program: FOR I=1 TO 10 : PRINT I : NEXT.
    expect(programVocabulary('10 FORI=1TO10:PRINTI:NEXT', c64)).toEqual({
      dialectId: 'commodore64',
      keywords: ['FOR', 'NEXT', 'PRINT', 'TO'],
      escapeCodes: [],
      characters: [...'01:=EFINOPRTX'],
      multiStatementLines: [1],
    });
  });

  it('does not find keywords inside variable names on a dialect that does not crunch', () => {
    // The whole reason the `crunched` flag exists: matching anywhere here would
    // report TO (in TOTAL%) and IF (in DIFF%) as commands the program uses.
    const vocab = programVocabulary(
      '10 total%=5\n20 diff%=total%-1\n30 PRINT total%',
      bbc,
    );
    expect(vocab.keywords).toEqual(['PRINT']);
  });

  it('reads a keyword glued to punctuation on a dialect that does not crunch', () => {
    const vocab = programVocabulary('10 PRINT LEFT$("HELLO",2)', bbc);
    expect(vocab.keywords).toContain('LEFT$');
  });

  it('ignores keywords inside strings and after REM', () => {
    const vocab = programVocabulary(
      '10 PRINT "PRESS GOTO OR STOP"\n20 REM SEE GOSUB 100 AND PLOT',
      bbc,
    );
    expect(vocab.keywords).toEqual(['PRINT']);
  });

  it('ignores machine-code block lines', () => {
    // A `#BIN` payload is base64: scanning it for keywords finds whatever
    // letters the bytes happen to spell.
    const vocab = programVocabulary('#BIN Zm9ybmV4dHByaW50\n10 PRINT 1', c64);
    expect(vocab.keywords).toEqual(['PRINT']);
  });

  it('reads an unnumbered line as code', () => {
    expect(programVocabulary('PRINT 1', c64).keywords).toEqual(['PRINT']);
  });
});

describe('programVocabulary - escape codes', () => {
  it('records braced escapes by byte', () => {
    const vocab = programVocabulary('10 PRINT "{clr}{white}HI"', c64);
    expect(vocab.escapeCodes).toEqual([0x05, 0x93]);
  });

  it('records only the leading byte of an operand-carrying escape', () => {
    // `{INK 2}` is 0x10 0x02; the docs escape row for it claims 0x10 alone, so
    // that is what identifies the code.
    const vocab = programVocabulary('10 PRINT "{INK 2}HI"', spectrum);
    expect(vocab.escapeCodes).toEqual([0x10]);
  });

  it('records Sinclair backslash escapes', () => {
    const vocab = programVocabulary('10 PRINT "\\::\\.."', zx81);
    expect(vocab.escapeCodes).toEqual([0x80, 0x83]);
  });

  it('records nothing for a literal of plain characters', () => {
    expect(programVocabulary('10 PRINT "HELLO"', c64).escapeCodes).toEqual([]);
  });

  it('ignores escapes written after a REM', () => {
    const vocab = programVocabulary('10 REM PRINT "{clr}"', c64);
    expect(vocab.escapeCodes).toEqual([]);
  });

  it('yields a partial vocabulary when a literal cannot be read', () => {
    // Half-typed escapes throw CharsetError. Everything already found stands,
    // so ordinary editing does not keep discarding the narrowing.
    const vocab = programVocabulary('10 PRINT "{clr}{whi"\n20 CLR', c64);
    expect(vocab.escapeCodes).toEqual([0x93]);
    expect(vocab.keywords).toEqual(['CLR', 'PRINT']);
  });
});

describe('programVocabulary - characters', () => {
  it('records the characters of code, strings and REM bodies alike', () => {
    // All three are stored through the same charset, so a character the target
    // lacks fails in a comment exactly as it does in a string.
    const vocab = programVocabulary('10 PRINT "HI!"\n20 REM &', c64);
    expect(vocab.characters).toContain('!');
    expect(vocab.characters).toContain('&');
  });

  it('does not record an escape spelling as characters', () => {
    // `{clr}` is one control code. Recording `{`, `c`, `l`, `r` and `}` would
    // report characters the program does not use - and `{` is one the C64
    // cannot represent, so it would invent a finding.
    const vocab = programVocabulary('10 PRINT "{clr}A"', c64);
    // The line number is stripped with the line; `PRINT "A"` is what is left.
    expect(vocab.characters).toEqual([...' "AINPRT']);
    expect(vocab.characters).not.toContain('{');
  });

  it('records a block graphic as a control code and not as a character', () => {
    // The two scans partition the program: one difference, one finding.
    const vocab = programVocabulary('10 PRINT "\\::"', zx81);
    expect(vocab.escapeCodes).toEqual([0x80]);
    expect(vocab.characters).not.toContain('\\');
    expect(vocab.characters).not.toContain(':');
  });

  it('records the inverse-video prefix as neither', () => {
    // `%A` is one inverse-video character on a ZX81, not a `%` and an `A`.
    const vocab = programVocabulary('10 PRINT "%A"', zx81);
    expect(vocab.characters).not.toContain('%');
  });
});

describe('programVocabulary - multi-statement lines', () => {
  it('reports a line carrying several statements', () => {
    const vocab = programVocabulary('10 A=1:B=2\n20 C=3', c64);
    expect(vocab.multiStatementLines).toEqual([1]);
  });

  it('reports the editor line, not the BASIC line number', () => {
    // Blank lines are skipped by the scan, so the position cannot be recovered
    // by counting the lines it returns.
    const vocab = programVocabulary('\n\n100 A=1:B=2', c64);
    expect(vocab.multiStatementLines).toEqual([3]);
  });

  it('does not count a separator inside a string or after REM', () => {
    const vocab = programVocabulary('10 PRINT "A:B"\n20 REM A:B', c64);
    expect(vocab.multiStatementLines).toEqual([]);
  });

  it('does not count a trailing or doubled separator', () => {
    // Real tape programs carry these; an empty statement is not one to split.
    const vocab = programVocabulary('10 A=1:\n20 B=2::C=3', c64);
    expect(vocab.multiStatementLines).toEqual([2]);
  });

  it('reports nothing on a machine with no statement separator', () => {
    // The ZX81 has no separator, and `:` is ordinary text on it. Defaulting to
    // `:` here would report this line as two statements.
    const vocab = programVocabulary('10 PRINT "TIME: ";T', zx81);
    expect(vocab.multiStatementLines).toEqual([]);
  });

  it('splits on the machine’s own separator', () => {
    // The Atom separates with `;`, so a `:` is not a boundary there.
    const atom = getDialect('atom');
    expect(programVocabulary('10 A=1;B=2', atom).multiStatementLines).toEqual([
      1,
    ]);
    expect(programVocabulary('10 A=1:B=2', atom).multiStatementLines).toEqual(
      [],
    );
  });
});

describe('programVocabulary - no program', () => {
  it('is empty for an empty program', () => {
    expect(programVocabulary('', c64)).toEqual({
      dialectId: 'commodore64',
      keywords: [],
      escapeCodes: [],
      characters: [],
      multiStatementLines: [],
    });
  });

  it('is empty for text with nothing recognisable in it', () => {
    expect(programVocabulary('10 zzz=1', c64).keywords).toEqual([]);
  });

  it('answers for the dialect it was asked about, not the program', () => {
    // The same text read as two languages: what a program's vocabulary *is*
    // depends on which BASIC reads it.
    expect(programVocabulary('10 FORI=1TO10', c64).keywords).toEqual([
      'FOR',
      'TO',
    ]);
    expect(programVocabulary('10 FORI=1TO10', bbc).keywords).toEqual([]);
  });
});
