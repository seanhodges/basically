// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, it, expect } from 'vitest';
import { ge235Keywords } from '../ge235/keywords';
import { ge635Keywords, ge635Operators, ge635Statements } from './keywords';

const words = new Set(ge635Keywords.map((k) => k.word));

describe('ge635 keywords', () => {
  it('carries the statement set the fourth edition specifies', () => {
    expect([...ge635Statements].sort()).toEqual([
      'CHANGE',
      'DATA',
      'DEF',
      'DIM',
      'END',
      'FNEND',
      'FOR',
      'GOSUB',
      'GOTO',
      'IF',
      'INPUT',
      'LET',
      'MAT',
      'NEXT',
      'ON',
      'PRINT',
      'RANDOM',
      'RANDOMIZE',
      'READ',
      'REM',
      'RESTORE',
      'RESTORE$',
      'RESTORE*',
      'RETURN',
      'STOP',
    ]);
  });

  it('tries the two RESTORE suffixes before the bare word', () => {
    // Longest first, so the suffix that says which DATA block to rewind is not
    // read as the start of the rest of the line (2.7).
    const order = ge635Statements.indexOf.bind(ge635Statements);
    expect(order('RESTORE$')).toBeLessThan(order('RESTORE'));
    expect(order('RESTORE*')).toBeLessThan(order('RESTORE'));
  });

  it('adds exactly what the fourth edition adds to February 1965', () => {
    const before = new Set(ge235Keywords.map((k) => k.word));
    const added = [...words].filter((w) => !before.has(w)).sort();
    expect(added).toEqual([
      'CHANGE',
      'CON',
      'COT',
      'DET',
      'FNEND',
      'IDN',
      'INV',
      'MAT',
      'NUM',
      'ON',
      'RANDOM',
      'RANDOMIZE',
      'RESTORE',
      'RESTORE$',
      'RESTORE*',
      'SGN',
      'TAB',
      'TRN',
      'ZER',
    ]);
    // And takes nothing away: this is a superset of the language it grew from.
    expect([...before].filter((w) => !words.has(w))).toEqual([]);
  });

  it('carries the fourteen library functions of 1.2, 2.2 and 2.6', () => {
    const fns = ge635Keywords
      .filter((k) => k.kind === 'function')
      .map((k) => k.word)
      .filter((w) => !['FN', 'INV', 'TRN'].includes(w));
    expect([...fns].sort()).toEqual([
      'ABS',
      'ATN',
      'COS',
      'COT',
      'DET',
      'EXP',
      'INT',
      'LOG',
      'NUM',
      'RND',
      'SGN',
      'SIN',
      'SQR',
      'TAB',
      'TAN',
    ]);
  });

  it('gives RND, NUM and DET no argument', () => {
    // 2.2: "The form of RND does not require an argument", and the manual's own
    // examples read INT(10*RND). NUM and DET are the same shape - a value the
    // last MAT INPUT or MAT INV left behind.
    for (const word of ['RND', 'NUM', 'DET']) {
      const k = ge635Keywords.find((e) => e.word === word)!;
      expect(k.signature, word).toBe(word);
    }
    expect(ge635Keywords.find((k) => k.word === 'SGN')!.signature).toBe(
      'SGN(x)',
    );
  });

  it('has no file statement and no string function', () => {
    // FILES occurs once in the whole manual, in Appendix E's list of what is
    // not yet built; the string library and CHAIN are the fifth edition's and
    // SUB the sixth's.
    for (const word of [
      'FILES',
      'CHAIN',
      'COMMON',
      'SUB',
      'LINPUT',
      'USING',
      'LEN',
      'SEG$',
      'STR$',
      'VAL',
      'ASC',
      'POS',
      'CHR$',
      'PEEK',
      'POKE',
      'AND',
      'OR',
      'NOT',
    ]) {
      expect(words.has(word), `${word} is not a fourth-edition keyword`).toBe(
        false,
      );
    }
  });

  it('keeps the up arrow and the six relations of 1.2', () => {
    expect(ge635Operators).toContain('↑');
    expect(ge635Operators).not.toContain('^');
    expect(ge635Operators).not.toContain('**');
    // 2.8's ILLEGAL RELATION calls them "the six permissible relational
    // symbols"; `<>` is not-equal, and the reversed spellings are not among
    // them.
    const relations = ge635Operators.filter((o) => /[<>=]/.test(o));
    expect([...relations].sort()).toEqual(['<', '<=', '<>', '=', '>', '>=']);
    // No `&`: concatenation arrives in the fifth edition, not this one.
    expect(ge635Operators).not.toContain('&');
  });

  it('gives every entry a distinct ordinal, signature and doc', () => {
    expect(new Set(ge635Keywords.map((k) => k.token)).size).toBe(
      ge635Keywords.length,
    );
    expect(new Set(words).size).toBe(ge635Keywords.length);
    for (const k of ge635Keywords) {
      expect(k.signature, k.word).toBeTruthy();
      expect(k.doc, k.word).toBeTruthy();
    }
  });
});
