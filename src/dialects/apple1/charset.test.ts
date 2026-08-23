import { describe, expect, it } from 'vitest';
import { CharsetError } from '../types';
import {
  apple1Charset,
  decodeSpan,
  GLYPH_BASE,
  GLYPH_TOP,
  parseChar,
} from './charset';

describe('apple1 charset', () => {
  it('is total and injective over all 256 bytes', () => {
    // Every byte has exactly one text form and that form encodes back to the
    // same byte, which is what the shared charset probes will require of this
    // dialect once it is registered.
    const seen = new Map<string, number>();
    for (let code = 0; code < 256; code++) {
      const text = apple1Charset.toUnicode([code]);
      expect(seen.has(text)).toBe(false);
      seen.set(text, code);
      expect([...apple1Charset.toMachine(text)]).toEqual([code]);
    }
    expect(seen.size).toBe(256);
  });

  it('draws exactly the 64 glyphs the 2513 holds', () => {
    const drawable = [];
    for (let code = 0; code < 256; code++)
      if (!apple1Charset.toUnicode([code]).startsWith('{')) drawable.push(code);
    expect(drawable).toHaveLength(64);
    expect(drawable[0]).toBe(GLYPH_BASE);
    expect(drawable[63]).toBe(GLYPH_TOP);
    // The set is ASCII 0x20-0x5F with bit 7 set: space through underscore, so
    // the digits and A-Z are in and lower case is not.
    expect(apple1Charset.toUnicode(drawable)).toBe(
      ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_',
    );
  });

  it('stores every character with bit 7 set', () => {
    for (const code of apple1Charset.toMachine('PRINT "HI" 123'))
      expect(code & 0x80).toBe(0x80);
    expect([...apple1Charset.toMachine('A')]).toEqual([0xc1]);
    expect([...apple1Charset.toMachine(' ')]).toEqual([0xa0]);
  });

  it('folds lower case, which the machine cannot type or draw', () => {
    expect([...apple1Charset.toMachine('abc')]).toEqual([
      ...apple1Charset.toMachine('ABC'),
    ]);
  });

  it('refuses a character with no Apple I equivalent', () => {
    expect(() => apple1Charset.toMachine('é')).toThrow(CharsetError);
    // Braces are outside the 64-glyph set, so the escape syntax cannot collide
    // with a literal brace the way it can on a full-ASCII machine.
    expect(() => apple1Charset.toMachine('{')).toThrow(CharsetError);
    expect(() => apple1Charset.toMachine('}')).toThrow(CharsetError);
  });

  it('reads a raw-byte escape back to its byte', () => {
    expect(parseChar('{0x0D}', 0)).toEqual({ code: 0x0d, length: 6 });
    expect(decodeSpan([0x0d], 0, 1)).toEqual({ text: '{0x0D}', length: 1 });
  });

  it('renders an undrawable code as a space in the debug glyph', () => {
    expect(apple1Charset.glyph(0xc1)).toBe('A');
    expect(apple1Charset.glyph(0x00)).toBe(' ');
  });
});
