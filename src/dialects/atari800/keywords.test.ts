// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  ATARI_ALIASES,
  ATARI_TOKENS,
  atariExpressions,
  atariKeywords,
  atariOperators,
  atariStatements,
} from './keywords';

describe('Atari BASIC keyword tables', () => {
  it('gives each statement token exactly one spelling, $00 upward', () => {
    const tokens = atariStatements.map((k) => k.token);
    expect(tokens).toEqual([...tokens].sort((a, b) => a - b));
    expect(new Set(tokens).size).toBe(tokens.length);
    expect(tokens[0]).toBe(0x00);
    // $36 and $37 are the implied LET and the syntax-error marker, and neither
    // has a spelling, so the spelled statements stop at $35.
    expect(tokens[tokens.length - 1]).toBe(0x35);
    expect(tokens).not.toContain(ATARI_TOKENS.IMPLIED_LET);
    expect(tokens).not.toContain(ATARI_TOKENS.SYNTAX_ERROR);
  });

  it('gives each expression token exactly one spelling, up to STRIG at $54', () => {
    const tokens = atariExpressions.map((k) => k.token);
    expect(tokens).toEqual([...tokens].sort((a, b) => a - b));
    expect(new Set(tokens).size).toBe(tokens.length);
    expect(tokens[tokens.length - 1]).toBe(0x54);
    // The three tokens the scanner writes by hand carry no spelling.
    for (const token of [
      ATARI_TOKENS.NUMERIC_CONSTANT,
      ATARI_TOKENS.STRING_CONSTANT,
      ATARI_TOKENS.END_OF_STATEMENT,
    ]) {
      expect(tokens).not.toContain(token);
    }
  });

  // The two spaces overlap, which is the whole reason `space` exists: $20 is
  // PRINT in one and `<` in the other.
  it('lets one byte mean different things in the two spaces', () => {
    expect(atariStatements.find((k) => k.token === 0x20)!.word).toBe('PRINT');
    expect(atariExpressions.find((k) => k.token === 0x20)!.word).toBe('<');
    expect(atariStatements.every((k) => k.space === 'statement')).toBe(true);
    expect(atariExpressions.every((k) => k.space === 'expression')).toBe(true);
  });

  it('repeats a spelling only where the parse gives it several bytes', () => {
    const equals = atariExpressions.filter((k) => k.word === '=');
    expect(equals.map((k) => k.token)).toEqual([0x22, 0x2d, 0x2e, 0x34]);
    const brackets = atariExpressions.filter((k) => k.word === '(');
    expect(brackets.map((k) => k.token)).toEqual([
      0x2b, 0x37, 0x38, 0x39, 0x3a, 0x3b,
    ]);
  });

  describe('the table the editor sees', () => {
    it('holds spelled words only, each once', () => {
      const words = atariKeywords.map((k) => k.word);
      expect(new Set(words).size).toBe(words.length);
      expect(words.every((w) => /^[A-Z]/.test(w))).toBe(true);
      expect(words).toContain('PRINT');
      expect(words).toContain('SETCOLOR');
      expect(words).toContain('STRIG');
      expect(words).toContain('AND');
    });

    it('leaves the symbols to the operator list and the punctuation to neither', () => {
      for (const symbol of atariOperators) {
        expect(atariKeywords.map((k) => k.word)).not.toContain(symbol);
      }
      for (const punctuation of [',', ':', ';', '(', ')', '#']) {
        expect(atariKeywords.map((k) => k.word)).not.toContain(punctuation);
      }
    });

    it('leaves ? to the alias list, since LIST gives it back as PRINT', () => {
      expect(atariKeywords.map((k) => k.word)).not.toContain('?');
      expect(ATARI_ALIASES.map((k) => k.word)).toEqual(['?']);
      expect(ATARI_ALIASES[0]!.token).toBe(0x28);
      expect(ATARI_ALIASES[0]!.alias).toBe(true);
    });
  });

  it('signs and documents every keyword the editor offers', () => {
    for (const keyword of atariKeywords) {
      expect(keyword.signature, keyword.word).toBeTruthy();
      expect(keyword.doc, keyword.word).toBeTruthy();
    }
  });
});
