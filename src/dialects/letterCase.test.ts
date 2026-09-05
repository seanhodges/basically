// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The declared letter-case facts, pinned against the machines they describe.
 *
 * A table restating what a ROM does can drift from the ROM, and a restatement
 * that has drifted looks exactly like one that has not. So this test asserts
 * the declaration twice over:
 *
 *  - a **restatement**, written out in prose per machine and compared field by
 *    field, so a value changed in the table without anyone meaning to fails
 *    here rather than downstream;
 *  - four **behavioural arms** that re-derive each fact from the code that
 *    implements it - the dialect's own charset, its lint, its variable
 *    identity rule and its glyph sources - so a declaration that stops matching
 *    the machine fails rather than merely disagreeing.
 *
 * The registry decides what is checked: a machine added without an entry fails,
 * and so does an entry for a machine that is not registered.
 */
import { describe, expect, it } from 'vitest';
import { dialects, getDialect } from './registry';
import { probeFor } from './charsetProbes';
import { sourceFor } from './glyphSources';
import {
  LETTER_CASE,
  distinguishesNameCase,
  foldsKeywordCase,
  letterCaseFor,
  warnsOnLowerCaseKeyword,
  type LetterCaseFacts,
} from './letterCase';
import { LOWER_CASE_KEYWORD_HINT } from '../editor/keywordCase';
import { sameVariable } from '../editor/variableIdentity';
import { lexisFor } from '../editor/variableLexis';

/**
 * Each machine's facts written out again, in prose rather than as values.
 *
 * Deliberately a second authoring of the same claim: it is the difference
 * between "the table says what the table says" and "someone stated these four
 * things about this machine twice and they agreed".
 */
const RESTATED: Record<string, string> = {
  zx80: 'no lower case; keyword case folds; names fold; encoding folds',
  zx81: 'no lower case; keyword case folds; names fold; encoding folds',
  zxspectrum:
    'lower case always; keyword case folds; names fold; encoding preserves',
  zxspectrum128:
    'lower case always; keyword case folds; names fold; encoding preserves',
  bbcmicro:
    'lower case always; keywords upper case only; names are case-sensitive; encoding preserves',
  bbcmaster:
    'lower case always; keywords upper case only; names are case-sensitive; encoding preserves',
  commodore64:
    'lower case switched; keyword case folds; names fold; encoding folds',
  pet: 'lower case switched; keyword case folds; names fold; encoding folds',
  vic20: 'lower case switched; keyword case folds; names fold; encoding folds',
  atom: 'no lower case; keywords upper case only; names fold; encoding preserves; dialect is lenient',
  trs80: 'no lower case; keyword case folds; names fold; encoding preserves',
  cpc464:
    'lower case always; keyword case folds; names fold; encoding preserves',
  cpc664:
    'lower case always; keyword case folds; names fold; encoding preserves',
  cpc6128:
    'lower case always; keyword case folds; names fold; encoding preserves',
  altair8800:
    'no lower case; keyword case folds; names fold; encoding preserves',
  pmd85:
    'lower case always; keywords upper case only; names are case-sensitive; encoding preserves; dialect is lenient',
  apple1: 'no lower case; keyword case folds; names fold; encoding folds',
  apple2: 'no lower case; keyword case folds; names fold; encoding folds',
  apple2plus: 'no lower case; keyword case folds; names fold; encoding folds',
  atari800:
    'lower case always; keywords upper case only; names fold; encoding preserves; dialect is lenient',
  atari400:
    'lower case always; keywords upper case only; names fold; encoding preserves; dialect is lenient',
  hb10p:
    'lower case always; keyword case folds; names fold; encoding preserves',
  ge235: 'no lower case; keyword case folds; names fold; encoding folds',
  samcoupe:
    'lower case always; keyword case folds; names fold; encoding preserves',
};

/** Turn one restatement back into the fields it claims. */
function parse(prose: string): Omit<LetterCaseFacts, 'note'> {
  const parts = prose.split('; ');
  const has = (text: string) => parts.includes(text);
  const lowerCase = has('no lower case')
    ? 'none'
    : has('lower case switched')
      ? 'switched'
      : 'always';
  return {
    lowerCase,
    keywordScan: has('keyword case folds') ? 'folded' : 'upper-only',
    nameCase: has('names fold') ? 'folded' : 'sensitive',
    encoding: has('encoding folds') ? 'folded' : 'preserved',
    ...(has('dialect is lenient') ? { lenient: true as const } : {}),
  };
}

/** The machine code this dialect stores for `text`, through its own charset. */
function encode(dialectId: string, text: string): number[] {
  const probe = probeFor(dialectId);
  if (!probe) throw new Error(`${dialectId}: no charset probe`);
  return probe.parse(text);
}

/**
 * The machine's own spelling of PRINT, to write a keyword in lower case with.
 * Every registered machine has one; the fallback keeps the failure legible if
 * one ever does not.
 */
function printKeyword(dialectId: string): string {
  const { keywords } = getDialect(dialectId);
  const print = keywords.find((k) => k.word === 'PRINT');
  return (
    print?.word ??
    keywords.find((k) => k.kind === 'command' && /^[A-Z]{3,}$/.test(k.word))!
      .word
  );
}

describe('letter case', () => {
  it('is declared for every registered machine, and only those', () => {
    expect(Object.keys(LETTER_CASE).sort()).toEqual(
      dialects.map((d) => d.id).sort(),
    );
    expect(Object.keys(RESTATED).sort()).toEqual(
      dialects.map((d) => d.id).sort(),
    );
  });

  it('gives every machine a note saying where its facts come from', () => {
    for (const { id } of dialects) {
      expect(letterCaseFor(id)!.note.trim(), id).toMatch(/^\S.*\.$/s);
    }
  });

  describe.each(dialects.map((d) => d.id))('%s', (id) => {
    const facts = letterCaseFor(id)!;

    it('matches its restatement', () => {
      const { note: _note, ...declared } = facts;
      expect(declared).toEqual(parse(RESTATED[id]!));
    });

    it('encodes a lower-case letter as the declaration says', () => {
      const lower = encode(id, 'a');
      const upper = encode(id, 'A');
      if (facts.encoding === 'folded') expect(lower).toEqual(upper);
      else expect(lower).not.toEqual(upper);
    });

    it('reports a lower-case keyword exactly where the ROM refuses one', () => {
      const word = printKeyword(id);
      const errors = getDialect(id).lint(`10 ${word.toLowerCase()} "HI"`);
      const raised = errors.filter((e) =>
        e.message.startsWith(LOWER_CASE_KEYWORD_HINT),
      );
      if (warnsOnLowerCaseKeyword(id)) {
        expect(raised.length).toBeGreaterThan(0);
        // Advisory only: it says what the machine will make of the program,
        // and the author decides.
        expect(raised.every((e) => e.fatal === false)).toBe(true);
        expect(raised[0]!.message).toContain(word);
      } else {
        expect(raised).toEqual([]);
      }
    });

    it('tells two spellings of a name apart as the declaration says', () => {
      const same = sameVariable('abc', 'ABc', lexisFor(id));
      expect(same).toBe(facts.nameCase === 'folded');
      expect(distinguishesNameCase(id)).toBe(facts.nameCase === 'sensitive');
    });

    it('resolves a lower-case glyph exactly where the machine draws one', () => {
      // Only meaningful where the encoding keeps the two cases apart: on a
      // folding machine the lower-case letter *is* the capital's code, and
      // resolving it says nothing about lower-case shapes.
      if (facts.encoding === 'folded') return;
      // The Altair has no character generator of any kind, so it declares no
      // glyph sources at all - there is nothing here to resolve either way.
      if (id === 'altair8800') return;
      const code = encode(id, 'a')[0]!;
      const source = sourceFor(id, code);
      if (facts.lowerCase === 'none') expect(source, id).toBeUndefined();
      else expect(source, id).toBeDefined();
    });
  });

  describe('the predicates the consumers read', () => {
    it('folds keyword case everywhere but the Acorn BBCs', () => {
      const folding = dialects.map((d) => d.id).filter(foldsKeywordCase);
      expect(folding).not.toContain('bbcmicro');
      expect(folding).not.toContain('bbcmaster');
      expect(folding.length).toBe(dialects.length - 2);
    });

    it('warns only where the ROM matches by character and the encoding preserves', () => {
      expect(dialects.map((d) => d.id).filter(warnsOnLowerCaseKeyword)).toEqual(
        ['bbcmicro', 'bbcmaster', 'atom', 'pmd85', 'atari800', 'atari400'],
      );
    });

    it('reads a declared leniency as folding without silencing the report', () => {
      for (const id of ['atom', 'pmd85', 'atari800', 'atari400']) {
        expect(letterCaseFor(id)!.lenient, id).toBe(true);
        expect(foldsKeywordCase(id), id).toBe(true);
        expect(warnsOnLowerCaseKeyword(id), id).toBe(true);
      }
    });

    it('agrees with the variable lexis about which ROMs distinguish a name', () => {
      for (const { id } of dialects) {
        expect(lexisFor(id).caseSensitive, id).toBe(distinguishesNameCase(id));
      }
    });
  });
});
