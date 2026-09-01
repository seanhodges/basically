// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  HB10P_ALIASES,
  HB10P_PREFIXED,
  hb10pKeywords,
  hb10pKeywordsByLength,
  hb10pWordByToken,
} from './keywords';
import { tokenizeProgram } from './tokenizer';

describe('hb10p keywords', () => {
  it('gives every word one token and every token one word', () => {
    const words = hb10pKeywords.map((k) => k.word);
    expect(new Set(words).size).toBe(words.length);
    const tokens = hb10pKeywords.map((k) => k.token);
    expect(new Set(tokens).size).toBe(tokens.length);
    expect(hb10pWordByToken.size).toBe(hb10pKeywords.length);
  });

  it('numbers the single-byte tokens above the constant prefixes', () => {
    for (const k of hb10pKeywords) {
      if (k.token <= 0xff) {
        // 0x81-0xFC; below that are the typed-constant prefixes and plain
        // characters, and 0xFF is the function prefix rather than a word.
        expect(k.token, k.word).toBeGreaterThanOrEqual(0x81);
        expect(k.token, k.word).toBeLessThanOrEqual(0xfc);
      } else {
        // The rest are two bytes: the 0xFF prefix and a second byte.
        expect(k.token >> 8, k.word).toBe(0xff);
        expect(k.token & 0xff, k.word).toBeGreaterThanOrEqual(0x81);
      }
    }
  });

  it('matches the longest spelling first', () => {
    const lengths = hb10pKeywordsByLength.map((k) => k.word.length);
    expect([...lengths].sort((a, b) => b - a)).toEqual(lengths);
    // Which is what keeps PRESET from being read as PRESET's prefix PRE...
    expect([...tokenizeProgram('10 PRESET(0,0)').bytes.slice(4, 5)]).toEqual([
      0xc3,
    ]);
    // ...and DEFINT from being DEF and INT.
    expect([...tokenizeProgram('10 DEFINT A-Z').bytes.slice(4, 5)]).toEqual([
      0xac,
    ]);
  });

  it('keeps the entry-only synonyms out of the decode map', () => {
    // `?` and `'` are typed but never listed back: LIST gives PRINT and the
    // stored `:REM'` form.
    expect(HB10P_ALIASES.map((k) => k.word)).toEqual(['?', "'"]);
    for (const alias of HB10P_ALIASES) {
      expect(hb10pWordByToken.get(alias.token)?.word).not.toBe(alias.word);
    }
    expect([...tokenizeProgram('10 ?"HI"').bytes.slice(4, 5)]).toEqual([0x91]);
    expect(HB10P_PREFIXED.map((p) => p.bytes[0])).toEqual([0x3a, 0x3a]);
  });
});
