// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, it, expect } from 'vitest';
import { ge235Keywords, ge235Operators, ge235Statements } from './keywords';

const words = new Set(ge235Keywords.map((k) => k.word));

describe('ge235 keywords', () => {
  it('carries the statement set the q jump table can decode', () => {
    expect([...ge235Statements].sort()).toEqual([
      'DATA',
      'DEF',
      'DIM',
      'END',
      'FOR',
      'GOSUB',
      'GOTO',
      'IF',
      'INPUT',
      'LET',
      'NEXT',
      'PRINT',
      'READ',
      'REM',
      'RETURN',
      'STOP',
    ]);
  });

  it('carries the ten library functions and no eleventh', () => {
    const fns = ge235Keywords
      .filter((k) => k.kind === 'function' && k.word !== 'FN')
      .map((k) => k.word);
    expect([...fns].sort()).toEqual([
      'ABS',
      'ATN',
      'COS',
      'EXP',
      'INT',
      'LOG',
      'RND',
      'SIN',
      'SQR',
      'TAN',
    ]);
  });

  it('lacks the words that arrive with the machines that came after', () => {
    // Each of these is a real absence in the February 1965 compiler, and each
    // is one a program written for any other machine here would reach for.
    for (const word of [
      'RESTORE',
      'SGN',
      'ON',
      'RANDOMIZE',
      'TAB',
      'CHR$',
      'LEN',
      'MID$',
      'CLS',
      'POKE',
      'PEEK',
      'AND',
      'OR',
      'NOT',
    ]) {
      expect(words.has(word), `${word} is not a 1965 keyword`).toBe(false);
    }
  });

  it('spells the relations the way the if decoder reads them', () => {
    // `<` then an optional `=` or `>`, `>` then an optional `=`. So `<>` is the
    // not-equal spelling, and `=<` and `=>` are not accepted.
    expect(ge235Operators).toContain('<>');
    expect(ge235Operators).not.toContain('=<');
    expect(ge235Operators).not.toContain('=>');
    // The up arrow the ASR-33 has where a modern keyboard has `^`, and the only
    // way to raise to a power.
    expect(ge235Operators).toContain('↑');
    expect(ge235Operators).not.toContain('^');
    expect(ge235Operators).not.toContain('**');
  });

  it('gives every entry a distinct ordinal, signature and doc', () => {
    expect(new Set(ge235Keywords.map((k) => k.token)).size).toBe(
      ge235Keywords.length,
    );
    for (const k of ge235Keywords) {
      expect(k.signature, k.word).toBeTruthy();
      expect(k.doc, k.word).toBeTruthy();
    }
  });
});
