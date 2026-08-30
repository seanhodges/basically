// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APPLE2_DIRECT_ONLY,
  APPLE2_NAME_BREAKERS,
  APPLE2_UNREACHABLE,
  apple2Keywords,
  apple2Operators,
  T,
} from './keywords';
import { ROM_BASE } from './addresses';

/**
 * Check the keyword table against the interpreter image the machine ships with,
 * rather than against a spelling list copied from a manual.
 *
 * The Apple II has no reserved-word table to read. What it has is a syntax
 * table in `$EC00`-`$EDFF` and a decoder in `LIST` that finds a token's
 * spelling by counting keyword boundaries backwards through it: token N is the
 * Nth boundary below `$EDFF`, or below `$ECFF` for N >= `$51`. {@link spellingOf}
 * is that decoder, and every token this dialect claims has to come back out of
 * the image spelled the way the table says.
 *
 * A keyword's characters are stored in the table **reversed**, each with `$60`
 * added, and the last character of the spelling - the one at the lowest address
 * - additionally carries bit 6 to mark the boundary. That is why the decoder
 * walks downwards and stops on a byte >= `$C0`.
 */

const ROM = join(__dirname, '../../../public/roms/apple2.rom');
const image = new Uint8Array(readFileSync(ROM));

const at = (address: number): number => image[address - ROM_BASE]!;

/** What `LIST` prints for a token, read out of the shipped image. */
function spellingOf(token: number): string {
  let base = 0xed00;
  let remaining = token;
  if (token >= 0x51) {
    base = 0xec00;
    remaining = token - 0x50;
  }
  let y = 0;
  // Count keyword boundaries downwards; a boundary is a byte >= $C0, or any
  // byte below $80 (a grammar control byte between two rules).
  while (remaining > 0) {
    let a = at(base + y);
    for (;;) {
      const previous = a;
      y = (y - 1) & 0xff;
      a = at(base + y);
      if (a & 0x80 && (previous >= 0xc0 || !(previous & 0x80))) break;
    }
    remaining--;
  }
  let text = '';
  for (;;) {
    const b = at(base + y);
    if (!(b & 0x80)) break;
    text += String.fromCharCode(((b & 0x3f) + 0xa0) & 0x7f);
    y = (y - 1) & 0xff;
    if (b >= 0xc0) break;
  }
  return text;
}

/** Where the syntax table holds `word`, or -1. Boundary-flagged or not. */
function encoded(word: string): number {
  for (const flagged of [true, false]) {
    const bytes = [
      (word.charCodeAt(word.length - 1) + (flagged ? 0xa0 : 0x60)) & 0xff,
      ...[...word]
        .slice(0, -1)
        .reverse()
        .map((c) => (c.charCodeAt(0) + 0x60) & 0xff),
    ];
    outer: for (let i = 0; i + bytes.length <= image.length; i++) {
      for (let j = 0; j < bytes.length; j++)
        if (image[i + j] !== bytes[j]) continue outer;
      return i;
    }
  }
  return -1;
}

describe('apple2 keywords', () => {
  it('spells every keyword the way the shipped interpreter does', () => {
    const spellings = new Map<number, string>();
    for (const k of apple2Keywords) spellings.set(k.token, k.word);
    for (const [token, word] of spellings) {
      // LEN, ASC and SCRN carry their opening parenthesis in the token, so the
      // image spells them `LEN(` where the editor's word is `LEN` - the
      // parenthesis is punctuation the completion supplies.
      const carries = ['LEN', 'ASC', 'SCRN'].includes(word);
      const expected = carries ? `${word}(` : word;
      expect(`$${token.toString(16)} -> ${spellingOf(token)}`).toBe(
        `$${token.toString(16)} -> ${expected}`,
      );
    }
  });

  it('is the three two-argument-shaped functions that carry a parenthesis', () => {
    const carriers = apple2Keywords.filter((k) =>
      spellingOf(k.token).endsWith('('),
    );
    expect(carriers.map((k) => k.word)).toEqual(['ASC', 'LEN', 'SCRN']);
  });

  it('spells the context-dependent tokens the same way as their keyword', () => {
    // The tokenizer picks between these by grammar rule; the image has to agree
    // that they are all the same word, or a listing would decode wrongly.
    expect([T.PRINT_STR, T.PRINT_NUM, T.PRINT].map(spellingOf)).toEqual([
      'PRINT',
      'PRINT',
      'PRINT',
    ]);
    expect([T.INPUT_STR, T.INPUT_PROMPT, T.INPUT_NUM].map(spellingOf)).toEqual([
      'INPUT',
      'INPUT',
      'INPUT',
    ]);
    expect([T.DIM_STR, T.DIM_NUM].map(spellingOf)).toEqual(['DIM', 'DIM']);
    expect([T.THEN_LINE, T.THEN_STMT].map(spellingOf)).toEqual([
      'THEN',
      'THEN',
    ]);
    expect([T.DSP_STR, T.DSP_NUM].map(spellingOf)).toEqual(['DSP', 'DSP']);
    expect([T.NODSP_STR, T.NODSP_NUM].map(spellingOf)).toEqual([
      'NODSP',
      'NODSP',
    ]);
    expect([T.LIST, T.LIST_RANGE].map(spellingOf)).toEqual(['LIST', 'LIST']);
    expect([T.HLIN_AT, T.VLIN_AT].map(spellingOf)).toEqual(['AT', 'AT']);
    const commas = [
      T.SUBSTR_COMMA,
      T.INPUT_COMMA_STR,
      T.INPUT_COMMA_NUM,
      T.SCRN_COMMA,
      T.DIM_COMMA_STR,
      T.DIM_COMMA_NUM,
      T.PRINT_COMMA_STR,
      T.PRINT_COMMA_NUM,
      T.PRINT_COMMA_END,
      T.NEXT_COMMA,
      T.POKE_COMMA,
      T.PLOT_COMMA,
      T.HLIN_COMMA,
      T.VLIN_COMMA,
      T.LIST_COMMA,
      T.DEL_COMMA,
      T.AUTO_COMMA,
    ];
    expect(commas.map(spellingOf)).toEqual(commas.map(() => ','));
    const parens = [
      T.DIM_STR_LPAREN,
      T.SUBSTR_LPAREN,
      T.ARRAY_LPAREN,
      T.DIM_NUM_LPAREN,
      T.LPAREN,
      T.FN_LPAREN,
      T.STR_DEST_LPAREN,
    ];
    expect(parens.map(spellingOf)).toEqual(parens.map(() => '('));
    expect(spellingOf(T.RPAREN)).toBe(')');
  });

  it('spells the memory commands with : , not the Apple I equals', () => {
    // The single most likely thing to be copied wrong from the earlier machine:
    // `HIMEM=` there, `HIMEM:` here.
    expect(spellingOf(T.HIMEM_SET)).toBe('HIMEM:');
    expect(spellingOf(T.LOMEM_SET)).toBe('LOMEM:');
    const words = apple2Keywords.map((k) => k.word);
    expect(words).toContain('HIMEM:');
    expect(words).not.toContain('HIMEM=');
  });

  it('cancels AUTO with MAN, and erases with NEW', () => {
    expect(spellingOf(T.MAN)).toBe('MAN');
    expect(spellingOf(T.NEW)).toBe('NEW');
    // The Apple I's spellings for the same two jobs are no token here. (The
    // image does hold the bytes for `SCR`, because they are the tail of
    // `SCRN(`, so it is the decoder and not a byte search that settles this.)
    const spellings = new Set(
      Array.from({ length: 0x80 }, (_, t) => spellingOf(t)),
    );
    for (const word of ['OFF', 'SCR']) expect(spellings.has(word)).toBe(false);
    expect(encoded('OFF')).toBe(-1);
  });

  it('carries every word the Apple I lacks', () => {
    // Each of these is new on this machine, and finding the syntax table's own
    // encoding of it is what proves the image really holds it.
    const words = new Set(apple2Keywords.map((k) => k.word));
    for (const word of [
      'ASC',
      'SCRN',
      'PDL',
      'VLIN',
      'VTAB',
      'GR',
      'TEXT',
      'POP',
      'TRACE',
      'NOTRACE',
      'DSP',
      'NODSP',
      'LOAD',
      'SAVE',
      'CON',
      'MAN',
      'NEW',
      'AT',
    ]) {
      expect(`${word}:${encoded(word) >= 0}`).toBe(`${word}:true`);
      expect(words.has(word)).toBe(true);
    }
  });

  it('names the table entries no construct reaches', () => {
    // They are boundaries in the syntax table, so they consume token numbers and
    // an imported image can hold them; nothing typed at the machine produces one.
    for (const [token, word] of Object.entries(APPLE2_UNREACHABLE))
      expect(
        `$${Number(token).toString(16)} -> ${spellingOf(Number(token))}`,
      ).toBe(`$${Number(token).toString(16)} -> ${word}`);
    const claimed = new Set(apple2Keywords.map((k) => k.token));
    for (const token of Object.keys(APPLE2_UNREACHABLE))
      expect(claimed.has(Number(token))).toBe(false);
  });

  it('lists every prompt command as a keyword, and not LIST among them', () => {
    const words = new Set(apple2Keywords.map((k) => k.word));
    for (const word of APPLE2_DIRECT_ONLY) expect(words.has(word)).toBe(true);
    // LIST is legal inside a program line - `10 LIST` stores as $76 - so it is
    // the one prompt-looking command that is not refused there.
    expect(APPLE2_DIRECT_ONLY).not.toContain('LIST');
  });

  it('breaks a name only on words that may follow an expression', () => {
    const words = new Set(apple2Keywords.map((k) => k.word));
    for (const word of APPLE2_NAME_BREAKERS) expect(words.has(word)).toBe(true);
    expect([...APPLE2_NAME_BREAKERS].sort()).toEqual([
      'AND',
      'AT',
      'MOD',
      'OR',
      'STEP',
      'THEN',
      'TO',
    ]);
  });

  it('has one entry per spelling and a signature on each', () => {
    const words = apple2Keywords.map((k) => k.word);
    expect(new Set(words).size).toBe(words.length);
    for (const k of apple2Keywords) {
      expect(k.word).toBe(k.word.toUpperCase());
      expect(k.signature).toBeTruthy();
      expect(k.doc).toBeTruthy();
    }
  });

  it('orders the symbolic operators longest first', () => {
    const lengths = apple2Operators.map((o) => o.length);
    expect(lengths).toEqual([...lengths].sort((a, b) => b - a));
    expect(apple2Operators).toContain('#');
    // `^` works here, unlike on the Apple I, where the same token reaches no
    // handler: `PRINT 2^3` answers 8 at this machine's prompt.
    expect(apple2Operators).toContain('^');
  });
});
