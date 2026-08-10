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
      for (const [keyword, spellings] of shortSpellingsFor(dialect.id)) {
        for (const spelling of spellings) {
          const errors = getDialect(dialect.id).tokenize(
            `10 ${spelling}\n`,
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
