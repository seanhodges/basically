// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { apple2plus } from './index';
import { romFor } from '../bootHarness';
import {
  apple2plusKeywordAliases,
  apple2plusKeywords,
  apple2plusWordByToken,
} from './keywords';
import { BASIC_BASE, TOKEN_TABLE } from './addresses';

/**
 * The keyword table, re-walked out of the ROM on every run.
 *
 * `keywords.ts` was produced by this walk in the first place, so this is not a
 * second opinion - it is the measurement, kept live. A ROM replaced with
 * another build of Applesoft, or a spelling quietly corrected in the table,
 * fails here rather than showing up as a program that tokenizes to the wrong
 * bytes much later.
 */
function tableFromRom(rom: Uint8Array): { word: string; token: number }[] {
  const out: { word: string; token: number }[] = [];
  let word = '';
  let token = 0x80;
  for (let i = TOKEN_TABLE - BASIC_BASE; rom[i] !== 0x00; i++) {
    const byte = rom[i]!;
    word += String.fromCharCode(byte & 0x7f);
    // The high bit marks a keyword's last character; there is no separator.
    if (byte & 0x80) {
      out.push({ word, token });
      word = '';
      token++;
    }
  }
  return out;
}

describe('apple2plus keywords', () => {
  const rom = romFor(apple2plus.romUrl);

  it.runIf(rom.length > 0)(
    'carries the token byte the interpreter stores for each keyword',
    () => {
      const fromRom = tableFromRom(rom);
      expect(fromRom.length).toBe(107);
      expect(fromRom[0]).toEqual({ word: 'END', token: 0x80 });
      expect(fromRom[fromRom.length - 1]).toEqual({
        word: 'MID$',
        token: 0xea,
      });
      expect(
        apple2plusKeywords.map(({ word, token }) => ({ word, token })),
      ).toEqual(fromRom);
    },
  );

  it('scans in the ROM’s own table order, not longest-first', () => {
    // The four places where first-match and longest-match disagree, and the
    // ROM's order is what makes each read correctly.
    const order = apple2plusKeywords.map((k) => k.word);
    for (const [first, second] of [
      ['HGR2', 'HGR'],
      ['PR#', 'PRINT'],
      ['STORE', 'STOP'],
      ['AT', 'ATN'],
    ]) {
      expect(order.indexOf(first!), `${first} before ${second}`).toBeLessThan(
        order.indexOf(second!),
      );
    }
  });

  it('spells every keyword in something the parser can match', () => {
    for (const { word, kind } of apple2plusKeywords) {
      expect(word, `${word} is upper case and typeable`).toMatch(
        /^[A-Z0-9&?#=:$(+\-*/^<>]+$/,
      );
      expect(['command', 'function', 'operator']).toContain(kind);
    }
    // The three that carry their own opening parenthesis, and the two that
    // carry a colon, are part of the spelling rather than of the syntax.
    expect(apple2plusKeywords.map((k) => k.word)).toEqual(
      expect.arrayContaining(['TAB(', 'SPC(', 'SCRN(', 'HIMEM:', 'LOMEM:']),
    );
  });

  it('decodes each token back to one spelling', () => {
    expect(apple2plusWordByToken.size).toBe(apple2plusKeywords.length);
    expect(apple2plusWordByToken.get(0xba)).toBe('PRINT');
  });

  it('keeps ? out of the table it lists back from', () => {
    // `?` shares PRINT's token because the parser answers it before it scans,
    // so it must not be in the decode map or LIST would spell PRINT as `?`.
    expect(apple2plusKeywordAliases.map((k) => k.word)).toEqual(['?']);
    expect(apple2plusKeywordAliases[0]!.token).toBe(0xba);
    expect(apple2plusKeywords.some((k) => k.word === '?')).toBe(false);
  });
});
