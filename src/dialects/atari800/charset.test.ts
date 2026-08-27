// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { CharsetError } from '../types';
import { atariCharset } from './charset';
import { ATASCII_EOL } from './atascii';

describe('ATASCII charset', () => {
  it('round-trips every one of the 256 codes', () => {
    for (let code = 0; code < 0x100; code++) {
      const text = atariCharset.glyph(code);
      expect(text, `code $${code.toString(16)} has no text`).not.toBe('');
      expect([...atariCharset.toMachine(text)], text).toEqual([code]);
    }
  });

  it('gives every code a text form no other code shares', () => {
    const seen = new Map<string, number>();
    for (let code = 0; code < 0x100; code++) {
      const text = atariCharset.glyph(code);
      expect(
        seen.has(text),
        `${text} is shared with $${seen.get(text)?.toString(16)}`,
      ).toBe(false);
      seen.set(text, code);
    }
  });

  it('keeps ASCII where ASCII is', () => {
    expect(atariCharset.toUnicode([0x41, 0x61, 0x30, 0x20])).toBe('Aa0 ');
    // Both cases are in the one character set, so neither folds onto the other.
    expect([...atariCharset.toMachine('Aa')]).toEqual([0x41, 0x61]);
  });

  // The three ASCII positions ATASCII spends on something else are the ones a
  // program is most likely to trip over: a backtick, `{` and `~` are not there.
  it('puts card suits where ASCII has a backtick and a brace', () => {
    expect(atariCharset.glyph(0x60)).toBe('♦');
    expect(atariCharset.glyph(0x7b)).toBe('♠');
    expect(atariCharset.glyph(0x00)).toBe('♥');
    expect(atariCharset.glyph(0x10)).toBe('♣');
  });

  it('draws the low codes as their own graphics', () => {
    expect(atariCharset.glyph(0x12)).toBe('─');
    expect(atariCharset.glyph(0x11)).toBe('┌');
    expect(atariCharset.glyph(0x15)).toBe('▄');
  });

  it('names the control codes as escapes', () => {
    expect(atariCharset.glyph(0x1d)).toBe('{down}');
    expect(atariCharset.glyph(0x7d)).toBe('{clear}');
    expect(atariCharset.glyph(ATASCII_EOL)).toBe('{eol}');
    expect([...atariCharset.toMachine('{clear}HI')]).toEqual([
      0x7d, 0x48, 0x49,
    ]);
  });

  // The inverse-video half carries no shapes of its own - ANTIC inverts the
  // glyph of the code 128 below - so each one round-trips numerically.
  it('writes the inverse-video half as numeric escapes', () => {
    expect(atariCharset.glyph(0xc1)).toBe('{$c1}');
    expect([...atariCharset.toMachine('{$c1}')]).toEqual([0xc1]);
  });

  it('reports a character the Atari has no code for', () => {
    expect(() => atariCharset.toMachine('é')).toThrow(CharsetError);
    expect(() => atariCharset.toMachine('{nonsense}')).toThrow(CharsetError);
    expect(() => atariCharset.toMachine('{unclosed')).toThrow(CharsetError);
  });
});
