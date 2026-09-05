// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { CharsetError } from '../types';
import {
  apple2Charset,
  decodeSpan,
  GLYPH_BASE,
  GLYPH_TOP,
  parseChar,
  screenGlyph,
  videoMode,
} from './charset';

describe('apple2 charset', () => {
  it('is total and injective over all 256 bytes', () => {
    // Every byte has exactly one text form and that form encodes back to the
    // same byte, which is what the shared charset probes will require of this
    // dialect once it is registered.
    const seen = new Map<string, number>();
    for (let code = 0; code < 256; code++) {
      const text = apple2Charset.toUnicode([code]);
      expect(seen.has(text)).toBe(false);
      seen.set(text, code);
      expect([...apple2Charset.toMachine(text)]).toEqual([code]);
    }
    expect(seen.size).toBe(256);
  });

  it('writes plain text only for the run the machine itself prints', () => {
    const drawable = [];
    for (let code = 0; code < 256; code++)
      if (!apple2Charset.toUnicode([code]).startsWith('{')) drawable.push(code);
    expect(drawable).toHaveLength(64);
    expect(drawable[0]).toBe(GLYPH_BASE);
    expect(drawable[63]).toBe(GLYPH_TOP);
    // The set is ASCII 0x20-0x5F with bit 7 set: space through underscore, so
    // the digits and A-Z are in and lower case is not.
    expect(apple2Charset.toUnicode(drawable)).toBe(
      ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_',
    );
  });

  it('distinguishes normal, flashing and inverse video', () => {
    // The top two bits pick the mode and the low six the glyph, so the same
    // letter appears four times over the byte range and only one of those runs
    // is what COUT writes.
    expect(videoMode(0x01)).toBe('inverse');
    expect(videoMode(0x41)).toBe('flashing');
    expect(videoMode(0x81)).toBe('normal');
    expect(videoMode(0xc1)).toBe('normal');
    expect([0x01, 0x41, 0x81, 0xc1].map(screenGlyph)).toEqual([
      'A',
      'A',
      'A',
      'A',
    ]);
    expect(apple2Charset.toUnicode([0x01, 0x41, 0x81, 0xc1])).toBe(
      '{INVA}{FLASHA}{0x81}A',
    );
    // POKE 1024,1 puts an inverse A in the screen's top-left cell.
    expect([...apple2Charset.toMachine('{INVA}')]).toEqual([0x01]);
    expect([...apple2Charset.toMachine('{INV }')]).toEqual([0x20]);
    expect([...apple2Charset.toMachine('{FLASH@}')]).toEqual([0x40]);
  });

  it('stores every printable character with bit 7 set', () => {
    for (const code of apple2Charset.toMachine('PRINT "HI" 123'))
      expect(code & 0x80).toBe(0x80);
    expect([...apple2Charset.toMachine('A')]).toEqual([0xc1]);
    expect([...apple2Charset.toMachine(' ')]).toEqual([0xa0]);
  });

  it('folds lower case, which the machine cannot type or draw', () => {
    expect([...apple2Charset.toMachine('abc')]).toEqual([
      ...apple2Charset.toMachine('ABC'),
    ]);
  });

  it('refuses a character with no Apple II equivalent', () => {
    expect(() => apple2Charset.toMachine('é')).toThrow(CharsetError);
    // Braces are outside the 64-glyph set, so the escape syntax cannot collide
    // with a literal brace the way it can on a full-ASCII machine - and a
    // malformed escape is an error rather than a fallback to a literal brace.
    expect(() => apple2Charset.toMachine('{')).toThrow(CharsetError);
    expect(() => apple2Charset.toMachine('}')).toThrow(CharsetError);
    expect(() => apple2Charset.toMachine('{INVAB}')).toThrow(CharsetError);
  });

  it('reads a raw-byte escape back to its byte', () => {
    expect(parseChar('{0x81}', 0)).toEqual({ code: 0x81, length: 6 });
    expect(decodeSpan([0x81], 0, 1)).toEqual({ text: '{0x81}', length: 1 });
  });

  it('draws something for every byte in the debug glyph', () => {
    // Unlike the Apple I, there is no byte the character generator refuses:
    // every one of the 256 selects one of the 64 shapes in some video mode.
    expect(apple2Charset.glyph(0xc1)).toBe('A');
    expect(apple2Charset.glyph(0x00)).toBe('@');
    for (let code = 0; code < 256; code++)
      expect(apple2Charset.glyph(code)).toHaveLength(1);
  });
});
