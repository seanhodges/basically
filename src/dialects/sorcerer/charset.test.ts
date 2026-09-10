// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { CharsetError } from '../types';
import { SORCERER_GRAPHIC_CODES, sorcererCharset, plainChar } from './charset';
import {
  STANDARD_GRAPHICS_FIRST,
  STANDARD_GRAPHICS_LAST,
  USER_GRAPHICS_FIRST,
  USER_GRAPHICS_LAST,
  FIXED_SYMBOLS_LAST,
} from './addresses';

const ALL_CODES = Array.from({ length: 256 }, (_, i) => i);

/** The text form of one byte on its own. */
const decode = (code: number): string =>
  sorcererCharset.toUnicode(Uint8Array.of(code));

const RAW = /^\{0x[0-9A-F]{2}\}$/;

describe('sorcerer charset', () => {
  it('round-trips ASCII, both cases', () => {
    const text = ' !"#$%&\'()*+,-./0123456789:;<=>?@AZ[\\]^_`az{|}~';
    const bytes = sorcererCharset.toMachine(text);
    expect([...bytes]).toEqual([...text].map((c) => c.charCodeAt(0)));
    expect(sorcererCharset.toUnicode(bytes)).toBe(text);
  });

  it('is total and injective over every byte', () => {
    const seen = new Map<string, number>();
    for (const code of ALL_CODES) {
      const text = decode(code);
      expect(text.length, `0x${code.toString(16)}`).toBeGreaterThan(0);
      const clash = seen.get(text);
      expect(clash, `0x${code.toString(16)} and 0x${clash?.toString(16)}`).toBe(
        undefined,
      );
      seen.set(text, code);
      expect([...sorcererCharset.toMachine(text)], text).toEqual([code]);
    }
  });

  it('maps the whole standard graphics set but one pictorial code', () => {
    const escaped = SORCERER_GRAPHIC_CODES.filter((c) => RAW.test(decode(c)));
    expect(escaped).toEqual([0x8d]);
    // Everything else in the band is a single character, not a spelling.
    for (const code of SORCERER_GRAPHIC_CODES) {
      if (code === 0x8d) continue;
      const text = decode(code);
      expect([...text], `0x${code.toString(16)}`).toHaveLength(1);
    }
    expect(SORCERER_GRAPHIC_CODES[0]).toBe(STANDARD_GRAPHICS_FIRST);
    expect(SORCERER_GRAPHIC_CODES.at(-1)).toBe(STANDARD_GRAPHICS_LAST);
  });

  it('draws the box family from the same rules the junctions use', () => {
    expect(decode(0x97)).toBe('─');
    expect(decode(0xa2)).toBe('│');
    expect(decode(0xad)).toBe('┼');
    expect([0xbc, 0xbd, 0xbe, 0xbf].map(decode)).toEqual(['┌', '┐', '└', '┘']);
    expect([0xb2, 0xbb, 0xb4, 0xb9].map(decode)).toEqual(['┴', '┬', '├', '┤']);
    expect([0x8f, 0x90, 0x9a, 0x9b].map(decode)).toEqual(['╭', '╮', '╰', '╯']);
  });

  it('escapes the fixed symbols and the user-definable band', () => {
    // Neither band has a text form worth inventing: the first is 32 pictures
    // Unicode does not draw, and the second has no shape at all until a program
    // pokes one into generator RAM.
    for (let code = 0; code <= FIXED_SYMBOLS_LAST; code++) {
      expect(decode(code), `0x${code.toString(16)}`).toMatch(RAW);
    }
    for (let code = USER_GRAPHICS_FIRST; code <= USER_GRAPHICS_LAST; code++) {
      expect(decode(code), `0x${code.toString(16)}`).toMatch(RAW);
    }
    expect(decode(0x7f)).toMatch(RAW);
  });

  it('keeps a literal brace apart from an escape that follows it', () => {
    // `{`, `0`, `x`, `4`, `1`, `}` in a string would otherwise decode to text
    // that re-encodes as the single byte 0x41.
    const bytes = Uint8Array.from([0x7b, 0x30, 0x78, 0x34, 0x31, 0x7d]);
    const text = sorcererCharset.toUnicode(bytes);
    expect(text).toBe('{0x7B}0x41}');
    expect([...sorcererCharset.toMachine(text)]).toEqual([...bytes]);
  });

  it('reports a character the machine has no code for', () => {
    expect(() => sorcererCharset.toMachine('é')).toThrow(CharsetError);
  });

  it('shows a space for a code with no character of its own', () => {
    expect(sorcererCharset.glyph(0x41)).toBe('A');
    expect(sorcererCharset.glyph(0xa7)).toBe('▌');
    expect(sorcererCharset.glyph(0x00)).toBe(' ');
    expect(sorcererCharset.glyph(0xff)).toBe(' ');
    expect(plainChar(0x8d)).toBeUndefined();
  });
});
