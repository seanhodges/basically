// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PMD85_ALIASES,
  pmd85Keywords,
  pmd85KeywordsByLength,
  pmd85WordByToken,
} from './keywords';
import {
  IMAGE_BODY_OFFSET,
  RESERVED_WORDS_BASE,
  RESERVED_WORDS_END,
} from './addresses';
import { MONITOR_SIZE } from './romImage';

/**
 * The keyword table's whole claim is that it is the interpreter's own table, so
 * these tests read that table back out of the shipped ROM and compare. A typo
 * in a spelling or a slipped token would otherwise be invisible until a program
 * ran on the real machine and did the wrong thing.
 */
const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/pmd85/pmd85.rom')),
);

/** The interpreter body as it sits in RAM from 0x0000, past the load header. */
const body = rom.subarray(MONITOR_SIZE + IMAGE_BODY_OFFSET);

/** Walk the ROM's reserved-word table: first character high, 0x80 terminates. */
function romKeywords(): { word: string; token: number }[] {
  const out: { word: string; token: number }[] = [];
  let i = RESERVED_WORDS_BASE;
  let token = 0x80;
  while (body[i] !== 0x80) {
    let word = String.fromCharCode(body[i]! & 0x7f);
    i++;
    while (i < body.length && (body[i]! & 0x80) === 0) {
      word += String.fromCharCode(body[i]!);
      i++;
    }
    out.push({ word, token });
    token++;
  }
  return out;
}

describe('pmd85 keywords', () => {
  const fromRom = romKeywords();

  it('is exactly the interpreter reserved-word table, in token order', () => {
    expect(
      pmd85Keywords.map((k) => ({ word: k.word, token: k.token })),
    ).toEqual(fromRom);
  });

  it('ends where the table ends, at the 0x80 terminator', () => {
    // Anchors `addresses.ts`: a table that started one byte early would read a
    // RET opcode as a keyword and shift every token by one.
    expect(body[RESERVED_WORDS_BASE - 1]).toBe(0xc9); // the RET before it
    expect(body[RESERVED_WORDS_END]).toBe(0x80);
    expect(fromRom).toHaveLength(106);
    expect(fromRom.at(0)).toEqual({ word: 'END', token: 0x80 });
    expect(fromRom.at(-1)).toEqual({ word: 'DEG', token: 0xe9 });
  });

  it('gives every token exactly one canonical spelling', () => {
    expect(pmd85WordByToken.size).toBe(pmd85Keywords.length);
  });

  it('takes ? as a synonym for the _ statement, not for PRINT', () => {
    // The crunch routine substitutes 0xCE for '?' before any table lookup, and
    // 0xCE is `_`. PRINT is a different token entirely.
    expect(PMD85_ALIASES.map((k) => [k.word, k.token])).toEqual([['?', 0xce]]);
    expect(pmd85WordByToken.get(0xce)).toBe('_');
    expect(pmd85WordByToken.get(0x96)).toBe('PRINT');
  });

  it('resolves prefix pairs the same way the ROM scan does', () => {
    // The ROM takes the first table entry that matches, which is token order;
    // the tokenizer takes the longest. They agree only while the longer word of
    // every prefix pair holds the lower token.
    const pairs = pmd85KeywordsByLength.flatMap((short) =>
      pmd85KeywordsByLength
        .filter((long) => long !== short && long.word.startsWith(short.word))
        .map((long) => [short.word, long.word, short.token, long.token]),
    );
    expect(
      pairs.map(([s, l]) => `${String(l)} before ${String(s)}`).sort(),
    ).toEqual(
      [
        'INPUT before INP',
        'CONTROL before CONT',
        'OUTPUT before OUT',
        'ATN before AT',
      ].sort(),
    );
    for (const [, , shortToken, longToken] of pairs) {
      expect(Number(longToken)).toBeLessThan(Number(shortToken));
    }
  });

  it('marks the words the statement dispatch refuses as non-commands', () => {
    // The dispatch table sends these nine to the syntax-error handler: each is
    // a function or a PRINT-list modifier, never a statement opener.
    const notStatements = [
      'BIT',
      'ERR',
      'STATUS',
      'INKEY',
      'INK(',
      'APEEK',
      'ADR',
      'AT',
      'HEX$',
    ];
    for (const word of notStatements) {
      const kw = pmd85Keywords.find((k) => k.word === word);
      expect(kw, word).toBeDefined();
      expect(kw!.kind, word).not.toBe('command');
    }
  });

  it('suspends tokenizing after REM and DATA', () => {
    const rem = pmd85Keywords.find((k) => k.word === 'REM');
    const data = pmd85Keywords.find((k) => k.word === 'DATA');
    expect(rem?.verbatimRest).toBe('line');
    expect(data?.verbatimRest).toBe('statement');
  });

  it('documents every keyword it offers the editor', () => {
    for (const kw of pmd85Keywords) {
      expect(kw.signature, kw.word).toBeTruthy();
      expect(kw.doc, kw.word).toBeTruthy();
    }
  });
});
