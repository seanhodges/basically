/**
 * Pins the keyword tables this module keys by dialect id against the registry.
 *
 * The id-keyed table exists so the documentation bundle can reach it without a
 * registry - which also means a machine added to the registry and not to it
 * would quietly report that it abbreviates nothing, and its reference page
 * would quietly show no spellings. That is the failure this file exists to
 * make loud.
 */
import { describe, expect, it } from 'vitest';
import { dialects, getDialect } from './registry';
import {
  keywordSpellingsFor,
  shortSpellingsFor,
  spellingAt,
  spellingDialectIds,
} from './keywordSpellings';

/**
 * What has to follow a keyword before its statement is complete, for the
 * machines whose tokenizer checks that at entry rather than at run time.
 *
 * Every other dialect here tokenizes a keyword byte without looking at what
 * comes after it - the argument check, if there is one, waits for `RUN`. Atari
 * BASIC does not: it stores a program pre-parsed (see
 * `dialects/atari800/basfile.ts`), so a statement missing a required argument
 * is a real syntax error at the moment the line is entered - confirmed by
 * booting the real ROM and typing `LET`, `GOTO` and `IF` bare, which all come
 * back `ERROR-` there exactly as they do here. A short spelling is still a
 * short spelling either way, so the round trip below completes the statement
 * rather than dropping the keyword from the table.
 */
const COMPLETION: Record<string, Record<string, string>> = {
  atari800: {
    DATA: ' 1',
    INPUT: ' A',
    COLOR: ' 1',
    ENTER: ' "D:A"',
    LET: ' A=1',
    IF: ' 1 THEN 10',
    FOR: ' I=1 TO 1',
    NEXT: ' I',
    GOTO: ' 10',
    GOSUB: ' 10',
    TRAP: ' 10',
    COM: ' A(1)',
    CLOSE: ' #1',
    DIM: ' A(1)',
    OPEN: ' #1,4,0,"D:"',
    LOAD: ' "D:A"',
    SAVE: ' "D:A"',
    STATUS: ' #1,A',
    NOTE: ' #1,A,B',
    POINT: ' #1,A,B',
    XIO: ' 0,#1,0,0,"D:"',
    ON: ' 1 GOTO 10',
    POKE: ' 1,0',
    READ: ' A',
    GET: ' A',
    PUT: ' 65',
    GRAPHICS: ' 0',
    PLOT: ' 0,0',
    POSITION: ' 0,0',
    DRAWTO: ' 0,0',
    SETCOLOR: ' 0,0,0',
    LOCATE: ' 0,0,A',
    SOUND: ' 0,0,0,0',
  },
};
COMPLETION.atari400 = COMPLETION.atari800;

describe('the keyword tables behind the short spellings', () => {
  it('covers every registered machine, and no others', () => {
    expect([...spellingDialectIds].sort()).toEqual(
      dialects.map((d) => d.id).sort(),
    );
  });

  it('resolves against each machine’s own words and nobody else’s', () => {
    // The failure this guards is a machine resolving prefixes against another
    // machine's table - which would give a reference page a column of spellings
    // that are perfectly plausible and mean the wrong keyword.
    //
    // A subset rather than an equality, deliberately: the Atom's dot opens a
    // *statement*, so its order is its commands and leaves out operators like
    // TO, and asserting completeness would be asserting the opposite.
    for (const dialect of dialects) {
      const words = new Set(dialect.keywords.map((k) => k.word));
      for (const word of keywordSpellingsFor(dialect.id).order) {
        // Either spelling of a print formatter: the BBC's ROM holds the bracket
        // that is part of the token (`TAB(`) where its editor list drops it.
        expect(
          words.has(word) || words.has(word.replace(/\($/, '')),
          `${dialect.id} resolves prefixes against ${word}, which it lacks`,
        ).toBe(true);
      }
    }
  });

  it('resolves a spelling to the keyword its own machine reads', () => {
    const c64 = keywordSpellingsFor('commodore64');
    expect(spellingAt('pO53280,0', 0, c64)).toEqual({
      spelling: 'pO',
      keyword: 'POKE',
      length: 2,
    });
    // `?` is PRINT on a Commodore and byte indirection on an Acorn, so the
    // Acorn resolves nothing for it at all.
    expect(spellingAt('?"HI"', 0, c64)?.keyword).toBe('PRINT');
    expect(spellingAt('?32768', 0, keywordSpellingsFor('atom'))).toBeNull();
  });

  it('is the same answer the machine’s own tokenizer gives', () => {
    // One end-to-end pass over every machine: each spelling it offers has to
    // tokenize to something, rather than being a string the reference page
    // shows and the editor rejects.
    for (const dialect of dialects) {
      const completion = COMPLETION[dialect.id] ?? {};
      for (const [keyword, spellings] of shortSpellingsFor(dialect.id)) {
        const rest = completion[keyword] ?? '';
        for (const spelling of spellings) {
          const errors = getDialect(dialect.id).tokenize(
            `10 ${spelling}${rest}\n`,
          ).errors;
          expect(
            errors.filter((e) => e.fatal !== false),
            `${dialect.id}: ${spelling} (${keyword}) is rejected`,
          ).toEqual([]);
        }
      }
    }
  });
});
