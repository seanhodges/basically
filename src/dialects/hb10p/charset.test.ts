// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { CharsetError } from '../types';
import {
  decodeSpan,
  hb10pCharset,
  MSX_GLYPHS,
  MSX_GRAPHIC_GLYPHS,
  parseChar,
} from './charset';

/** Decode one byte the way a string literal would show it. */
const decode = (code: number): string => decodeSpan([code], 0, 1).text;

describe('hb10p charset', () => {
  it('maps the international set to and from unicode', () => {
    expect(hb10pCharset.toUnicode([0x41, 0x62, 0x20, 0x7e])).toBe('Ab ~');
    expect([...hb10pCharset.toMachine('Ab ~')]).toEqual([
      0x41, 0x62, 0x20, 0x7e,
    ]);
    // The accented letters, the fractions and the block graphics all have a
    // character of their own rather than an escape.
    expect(decode(0x87)).toBe('ç');
    expect(decode(0xb9)).toBe('ĳ');
    expect(decode(0xdb)).toBe('█');
    expect(decode(0xe3)).toBe('π');
    for (const [code, glyph] of Object.entries(MSX_GLYPHS)) {
      expect([...hb10pCharset.toMachine(glyph)], glyph).toEqual([Number(code)]);
    }
  });

  it('gives every byte one form, and no two bytes the same one', () => {
    const seen = new Map<string, number>();
    for (let code = 0; code < 0x100; code++) {
      const text = decode(code);
      expect(text.length, `0x${code.toString(16)}`).toBeGreaterThan(0);
      expect(
        seen.has(text),
        `${text} decodes both 0x${code.toString(16)} and 0x${seen.get(text)?.toString(16)}`,
      ).toBe(false);
      seen.set(text, code);
    }
    // The graphic forms are distinct from every single-byte one too, or the
    // two-byte spelling would not survive a round trip.
    for (const glyph of Object.values(MSX_GRAPHIC_GLYPHS)) {
      expect(seen.has(glyph), glyph).toBe(false);
    }
  });

  it('round-trips a graphic character through its 0x01 header byte', () => {
    // A graphic character is one editor character and two program bytes: the
    // 0x01 header, then the code plus 0x40.
    expect([...hb10pCharset.toMachine('⇨')]).toEqual([0x01, 0x51]);
    expect(hb10pCharset.toUnicode([0x01, 0x51])).toBe('⇨');
    for (const [code, glyph] of Object.entries(MSX_GRAPHIC_GLYPHS)) {
      const bytes = [0x01, Number(code) + 0x40];
      expect([...hb10pCharset.toMachine(glyph)], glyph).toEqual(bytes);
      expect(hb10pCharset.toUnicode(bytes), glyph).toBe(glyph);
    }
    // A header whose partner has no known shape stays two ordinary units, and
    // still comes back byte for byte.
    const unknown = hb10pCharset.toUnicode([0x01, 0x4a]);
    expect(unknown).toBe('{0x01}J');
    expect([...hb10pCharset.toMachine(unknown)]).toEqual([0x01, 0x4a]);
  });

  it('spells an unmapped byte as an escape and reads it back', () => {
    for (const code of [0x00, 0x0a, 0x1f, 0x7f, 0xff]) {
      const text = decode(code);
      expect(text).toBe(
        `{0x${code.toString(16).padStart(2, '0').toUpperCase()}}`,
      );
      expect([...hb10pCharset.toMachine(text)], text).toEqual([code]);
    }
    // A real brace is itself, unless the bytes after it would read as an
    // escape and swallow it.
    expect(hb10pCharset.toUnicode([0x7b, 0x41, 0x7d])).toBe('{A}');
    expect([...hb10pCharset.toMachine('{A}')]).toEqual([0x7b, 0x41, 0x7d]);
    const braced = [0x7b, 0x30, 0x78, 0x30, 0x31, 0x7d];
    expect([...hb10pCharset.toMachine(hb10pCharset.toUnicode(braced))]).toEqual(
      braced,
    );
  });

  it('refuses a character the machine has no glyph for', () => {
    expect(() => hb10pCharset.toMachine('日')).toThrow(CharsetError);
    expect(() => parseChar('日', 0)).toThrow(/no MSX equivalent/);
  });
});
