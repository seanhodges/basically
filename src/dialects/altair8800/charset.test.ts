// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { altair8800Charset, decodeSpan, parseChar } from './charset';

/**
 * The totality and injectivity cases here are the ones
 * `src/dialects/charsetProbes.test.ts` will also enforce across all 256 bytes
 * once the dialect is registered and gains a probe entry.
 */
describe('altair8800 charset', () => {
  it('maps printable ASCII 0x20-0x7E to itself', () => {
    const text = '10 PRINT "HELLO, WORLD!"';
    expect(altair8800Charset.toUnicode(altair8800Charset.toMachine(text))).toBe(
      text,
    );
    for (let b = 0x20; b <= 0x7e; b++) {
      expect(altair8800Charset.toUnicode([b])).toBe(String.fromCharCode(b));
    }
  });

  it('preserves lower case as its own codes', () => {
    // The interpreter's line editor upper-cases what you type outside quotes,
    // but a string literal keeps the bytes as typed, so the charset must not
    // fold them.
    expect(Array.from(altair8800Charset.toMachine('abc'))).toEqual([
      0x61, 0x62, 0x63,
    ]);
  });

  it('spells every control code as a {0xNN} escape', () => {
    expect(altair8800Charset.toUnicode([0x00])).toBe('{0x00}');
    expect(altair8800Charset.toUnicode([0x07])).toBe('{0x07}'); // bell
    expect(altair8800Charset.toUnicode([0x0d])).toBe('{0x0D}'); // carriage return
    expect(altair8800Charset.toUnicode([0x1f])).toBe('{0x1F}');
    expect(altair8800Charset.toUnicode([0x7f])).toBe('{0x7F}'); // rubout
  });

  it('spells the unused top-bit range 0x80-0xFF as a {0xNN} escape', () => {
    for (let b = 0x80; b <= 0xff; b++) {
      expect(altair8800Charset.toUnicode([b])).toMatch(/^\{0x[0-9A-F]{2}\}$/);
    }
    expect(altair8800Charset.toUnicode([0x96])).toBe('{0x96}'); // the PRINT token
    expect(altair8800Charset.toUnicode([0xff])).toBe('{0xFF}');
  });

  it('gives every byte 0x00-0xFF exactly one text form (totality)', () => {
    const forms = new Set<string>();
    for (let b = 0; b <= 0xff; b++) {
      const text = altair8800Charset.toUnicode([b]);
      expect(text.length).toBeGreaterThan(0);
      forms.add(text);
    }
    expect(forms.size).toBe(256);
  });

  it('re-encodes each canonical text form to its own byte (injectivity)', () => {
    for (let b = 0; b <= 0xff; b++) {
      const text = altair8800Charset.toUnicode([b]);
      const back = Array.from(altair8800Charset.toMachine(text));
      expect(
        back,
        `byte 0x${b.toString(16)} via ${JSON.stringify(text)}`,
      ).toEqual([b]);
    }
  });

  it('escapes a literal { only when the following bytes read as an escape', () => {
    // `{` is a real character (0x7B), so it normally stays itself…
    expect(altair8800Charset.toUnicode([0x7b, 0x41, 0x7d])).toBe('{A}');
    // …but a run that would parse back as an escape has to be escaped itself.
    const escapeLike = Array.from(
      altair8800Charset.toMachine('{0x41}'), // 0x7B 0x30 0x78 0x34 0x31 0x7D
    );
    expect(escapeLike).toEqual([0x41]);
    expect(
      altair8800Charset.toUnicode([0x7b, 0x30, 0x78, 0x34, 0x31, 0x7d]),
    ).toBe('{0x7B}0x41}');
  });

  it('parses one unit at a time, escape or plain character', () => {
    expect(parseChar('A', 0)).toEqual({ code: 0x41, length: 1 });
    expect(parseChar('{0x0D}', 0)).toEqual({ code: 0x0d, length: 6 });
    // A malformed brace group is literal text, not an escape.
    expect(parseChar('{nope}', 0)).toEqual({ code: 0x7b, length: 1 });
  });

  it('decodes one byte at a time, never reading past the end', () => {
    const bytes = Uint8Array.of(0x7b, 0x30, 0x78, 0x34, 0x31, 0x7d);
    // Bounded to the first byte, the trailing `}` is out of view, so nothing
    // reads as an escape and the brace stays a brace.
    expect(decodeSpan(bytes, 0, 1)).toEqual({ text: '{', length: 1 });
    expect(decodeSpan(bytes, 0, bytes.length)).toEqual({
      text: '{0x7B}',
      length: 1,
    });
  });

  it('rejects characters with no Altair equivalent', () => {
    expect(() => altair8800Charset.toMachine('café')).toThrow();
    expect(() => altair8800Charset.toMachine('█')).toThrow();
  });

  it('emits no characters outside ASCII, so needs no bundled font glyphs', () => {
    for (let b = 0; b <= 0xff; b++) {
      for (const ch of altair8800Charset.toUnicode([b])) {
        expect(ch.codePointAt(0)!).toBeLessThan(0x80);
      }
      expect(altair8800Charset.glyph(b).codePointAt(0)!).toBeLessThan(0x80);
    }
  });
});
