import { describe, expect, it } from 'vitest';
import { CharsetError } from '../types';
import { cpcCharset, decodeSpan, parseChar } from './charset';

/** Decode a single byte in a literal context to its editor text. */
function decodeByte(b: number): string {
  return decodeSpan([b], 0, 1).text;
}

/** Encode one editor unit (character or escape) to its machine byte(s). */
function encode(text: string): number[] {
  return parseChar(text, 0).codes;
}

describe('cpc464 charset totality', () => {
  it('round-trips every byte 0x00-0xFF through decode -> parse', () => {
    for (let b = 0; b <= 0xff; b++) {
      const text = decodeByte(b);
      expect(encode(text), `byte 0x${b.toString(16)} via ${text}`).toEqual([b]);
    }
  });

  it('maps 32-126 near-ASCII both ways', () => {
    for (let b = 0x20; b <= 0x7e; b++) {
      if (b === 0x5e) continue; // the CPC deviation, tested below
      const ch = String.fromCharCode(b);
      expect(decodeByte(b)).toBe(ch);
      expect(encode(ch)).toEqual([b]);
    }
  });

  it('shows 0x5E as the CPC up arrow, accepting ^ as input too', () => {
    expect(decodeByte(0x5e)).toBe('↑');
    expect(encode('↑')).toEqual([0x5e]);
    expect(encode('^')).toEqual([0x5e]);
    expect(cpcCharset.glyph(0x5e)).toBe('↑');
  });

  it('escapes control codes 0x00-0x1F as {0xNN} (never dropped)', () => {
    for (const b of [0x00, 0x07, 0x1f]) {
      const hex = b.toString(16).padStart(2, '0').toUpperCase();
      expect(decodeByte(b)).toBe(`{0x${hex}}`);
      expect(encode(`{0x${hex}}`)).toEqual([b]);
    }
  });

  it('gives the block-graphics and symbol range its unicode forms', () => {
    expect(decodeByte(0x8f)).toBe('█'); // full quadrant block
    expect(decodeByte(0x85)).toBe('▌'); // left half
    expect(decodeByte(0x9f)).toBe('┼'); // box drawing cross
    expect(decodeByte(0xa3)).toBe('£');
    expect(decodeByte(0xb8)).toBe('π');
    expect(decodeByte(0xe4)).toBe('♥');
    expect(encode('█')).toEqual([0x8f]);
    expect(encode('£')).toEqual([0xa3]);
  });

  it('escapes upper-half codes without a stable unicode form', () => {
    expect(decodeByte(0x7f)).toBe('{0x7F}');
    // The one graphics code with no character of its own: it draws a blank
    // cell, and 0x20 already owns the space.
    expect(decodeByte(0x80)).toBe('{0x80}');
    expect(decodeByte(0xff)).toBe('{0xFF}');
  });

  it('gives the diamond and dither codes their Legacy Computing forms', () => {
    expect(decodeByte(0xc0)).toBe('\u{1FBA0}'); // upper centre to middle left
    expect(decodeByte(0xca)).toBe('\u{1FBAE}'); // the whole diamond
    expect(decodeByte(0xce)).toBe('\u{1FB95}'); // 2x2 chequerboard
    expect(decodeByte(0xd8)).toBe('\u{1FB8E}'); // upper half medium shade
    expect(decodeByte(0xdf)).toBe('\u{1FB9F}'); // lower left triangular shade
    // Astral characters are surrogate pairs; parsing reads whole code points.
    expect(encode('\u{1FBAE}')).toEqual([0xca]);
    expect(encode('\u{1FB9F}')).toEqual([0xdf]);
    expect([...cpcCharset.toMachine('\u{1FBA0}\u{1FB8E}')]).toEqual([
      0xc0, 0xd8,
    ]);
  });

  it('still reads the escape spelling these codes used to render as', () => {
    // Programs saved before these gained characters must keep loading, and
    // encode to the same bytes they always did.
    for (const code of [0xc0, 0xca, 0xce, 0xd8, 0xdb, 0xdf]) {
      const hex = code.toString(16).padStart(2, '0').toUpperCase();
      expect(encode(`{0x${hex}}`)).toEqual([code]);
    }
  });

  it('keeps a non-escape brace literal, and escapes a colliding brace', () => {
    // "{X}" is not an escape: the '{' stays a literal 0x7B.
    expect(decodeSpan([0x7b, 0x58, 0x7d], 0, 3).text).toBe('{');
    // "{0x07}" as literal bytes would re-read as the escape, so escape '{'.
    const bytes = [0x7b, ...[...'0x07'].map((c) => c.charCodeAt(0)), 0x7d];
    expect(decodeSpan(bytes, 0, bytes.length).text).toBe('{0x7B}');
  });

  it('toUnicode/toMachine treat 0x0A/0x0D as newlines', () => {
    expect(cpcCharset.toUnicode([0x0a])).toBe('\n');
    expect(cpcCharset.toUnicode([0x0d])).toBe('\n');
    expect(Array.from(cpcCharset.toMachine('\n'))).toEqual([0x0a]);
  });

  it('throws CharsetError with the index for unmappable input', () => {
    try {
      cpcCharset.toMachine('AB€');
      expect.unreachable('expected a CharsetError');
    } catch (e) {
      expect(e).toBeInstanceOf(CharsetError);
      expect((e as CharsetError).index).toBe(2);
    }
  });
});
