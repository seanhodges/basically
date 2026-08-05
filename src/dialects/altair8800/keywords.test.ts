// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  ALTAIR8800_ALIASES,
  altair8800Keywords,
  altair8800KeywordsByLength,
  altair8800WordByToken,
} from './keywords';

/**
 * Structural checks on the table transcribed from the 8K BASIC 4.0 object tape
 * (see the file's own header for where the bytes came from). None of these can
 * tell a mis-transcribed *spelling* from a correct one - only the machine can,
 * which is what `tokenizer.test.ts`'s console-derived byte expectations are for
 * - but they do catch the mistakes an edit is likely to introduce.
 */
describe('altair8800 keywords', () => {
  it('runs from END = 0x80 to MID$ = 0xC5 with no gaps', () => {
    expect(altair8800Keywords).toHaveLength(70);
    expect(altair8800Keywords[0]).toMatchObject({ word: 'END', token: 0x80 });
    expect(altair8800Keywords.at(-1)).toMatchObject({
      word: 'MID$',
      token: 0xc5,
    });
    altair8800Keywords.forEach((kw, i) => {
      expect(kw.token, kw.word).toBe(0x80 + i);
    });
  });

  it('has one spelling per token and one token per spelling', () => {
    expect(altair8800WordByToken.size).toBe(altair8800Keywords.length);
    expect(new Set(altair8800Keywords.map((k) => k.word)).size).toBe(
      altair8800Keywords.length,
    );
    // Aliases stay out of the decode map so LIST has one spelling per token.
    for (const alias of ALTAIR8800_ALIASES) {
      expect(altair8800WordByToken.get(alias.token)).not.toBe(alias.word);
    }
  });

  it('marks REM and DATA as the verbatim-region keywords', () => {
    const verbatim = altair8800Keywords.filter((k) => k.verbatimRest);
    expect(verbatim.map((k) => [k.word, k.verbatimRest])).toEqual([
      ['DATA', 'statement'],
      ['REM', 'line'],
    ]);
  });

  it('orders every prefix pair longer-word-first, so greedy matching agrees with the ROM', () => {
    // The interpreter's CRUNCH takes the *first* table entry matching at the
    // cursor; this tokenizer takes the longest. The two agree only while any
    // word that prefixes another appears after it. INP/INPUT is the single such
    // pair in 8K BASIC - if an edit adds another the wrong way round, the
    // tokenizer would silently disagree with the machine.
    const pairs: [string, string][] = [];
    for (const a of altair8800Keywords) {
      for (const b of altair8800Keywords) {
        if (a !== b && b.word.startsWith(a.word)) {
          expect(
            a.token,
            `${a.word} must come after ${b.word}`,
          ).toBeGreaterThan(b.token);
          pairs.push([a.word, b.word]);
        }
      }
    }
    expect(pairs).toEqual([['INP', 'INPUT']]);
  });

  it('sorts the matching table longest spelling first', () => {
    const lengths = altair8800KeywordsByLength.map((k) => k.word.length);
    expect(lengths).toEqual([...lengths].sort((a, b) => b - a));
    expect(altair8800KeywordsByLength).toHaveLength(
      altair8800Keywords.length + ALTAIR8800_ALIASES.length,
    );
  });

  it('carries no keyword from the larger Microsoft BASICs', () => {
    // 8K BASIC predates all of these; a stray entry would tokenize to a byte
    // the interpreter reads as something else entirely.
    const words = new Set(altair8800Keywords.map((k) => k.word));
    for (const absent of [
      'ELSE',
      'INSTR',
      'STRING$',
      'LPRINT',
      'DEFINT',
      'VARPTR',
      'INKEY$',
      'RESUME',
      'ERROR',
      'CLS',
    ]) {
      expect(words.has(absent), absent).toBe(false);
    }
  });
});
