// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  SORCERER_ALIASES,
  sorcererKeywords,
  sorcererKeywordsByLength,
  sorcererOperators,
  sorcererWordByToken,
} from './keywords';
import { altair8800Keywords } from '../altair8800/keywords';
import { STATEMENT_TABLE_ENTRIES, TOKEN_BASE } from './addresses';

describe('sorcerer keywords', () => {
  it('runs from the first token byte with no gaps and no repeats', () => {
    const tokens = sorcererKeywords.map((k) => k.token);
    expect(tokens[0]).toBe(TOKEN_BASE);
    expect(tokens).toEqual(tokens.map((_, i) => TOKEN_BASE + i));
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it('gives the commands exactly the statement dispatch table', () => {
    // The dispatch table has one address per command token, so its length is
    // where the commands stop and TAB( begins.
    const commands = sorcererKeywords.filter((k) => k.kind === 'command');
    expect(commands).toHaveLength(STATEMENT_TABLE_ENTRIES);
    expect(commands.map((k) => k.token)).toEqual(
      commands.map((_, i) => TOKEN_BASE + i),
    );
    expect(commands.at(-1)!.word).toBe('NEW');
  });

  /**
   * The crosscheck that catches a transcription slip, and the reason it is
   * worth having: this is the Altair's interpreter with one word inserted, so
   * every spelling the two share must agree exactly up to BYE and be one
   * higher after it. An off-by-one anywhere in the table fails here rather
   * than turning into the wrong keyword in a running program.
   */
  it('is the Altair table with BYE inserted at 0x84', () => {
    const altair = new Map(altair8800Keywords.map((k) => [k.word, k.token]));
    expect(sorcererKeywords.find((k) => k.word === 'BYE')?.token).toBe(0x84);

    const extras = sorcererKeywords
      .filter((k) => !altair.has(k.word))
      .map((k) => k.word);
    expect(extras).toEqual(['BYE']);

    const missing = altair8800Keywords
      .filter((k) => !sorcererKeywords.some((s) => s.word === k.word))
      .map((k) => k.word);
    expect(missing).toEqual([]);

    for (const kw of sorcererKeywords) {
      if (kw.word === 'BYE') continue;
      const shift = kw.token > 0x84 ? 1 : 0;
      expect(kw.token - shift, `${kw.word}`).toBe(altair.get(kw.word));
    }
  });

  it('carries a signature and a doc for every entry', () => {
    for (const kw of sorcererKeywords) {
      expect(kw.signature, kw.word).toBeTruthy();
      expect(kw.doc, kw.word).toBeTruthy();
    }
  });

  it('marks the two words whose rest is stored verbatim', () => {
    const verbatim = sorcererKeywords.filter((k) => k.verbatimRest);
    expect(verbatim.map((k) => [k.word, k.verbatimRest])).toEqual([
      ['DATA', 'statement'],
      ['REM', 'line'],
    ]);
  });

  /**
   * The interpreter takes the *first* table entry that matches at the cursor;
   * this project matches the longest. The two agree only while every pair where
   * one spelling prefixes another lists the longer word first, and there is
   * exactly one such pair here.
   */
  it('lists the one prefix pair longer-word-first', () => {
    const words = sorcererKeywords.map((k) => k.word);
    const pairs = words.flatMap((a, i) =>
      words
        .filter((b, j) => i !== j && b.startsWith(a))
        .map((b) => [a, b] as const),
    );
    expect(pairs).toEqual([['INP', 'INPUT']]);
    expect(words.indexOf('INPUT')).toBeLessThan(words.indexOf('INP'));
    expect(sorcererKeywordsByLength[0]!.word.length).toBeGreaterThanOrEqual(
      sorcererKeywordsByLength.at(-1)!.word.length,
    );
  });

  it('enters ? as PRINT without listing it back', () => {
    expect(SORCERER_ALIASES).toEqual([
      { word: '?', token: 0x97, kind: 'command', alias: true },
    ]);
    expect(sorcererWordByToken.get(0x97)).toBe('PRINT');
    expect(sorcererKeywordsByLength.some((k) => k.word === '?')).toBe(true);
  });

  it('spells the relations the table does not tokenize', () => {
    expect([...sorcererOperators]).toEqual(['<=', '>=', '<>']);
    for (const op of ['<', '=', '>']) {
      expect(
        sorcererKeywords.some((k) => k.word === op),
        op,
      ).toBe(true);
    }
  });
});
