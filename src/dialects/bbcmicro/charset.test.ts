import { describe, expect, it } from 'vitest';
import { bbcCharset, decodeSpan, parseChar, TELETEXT_NAMES } from './charset';

/** Decode a single byte in a literal context to its editor text. */
function decodeByte(b: number): string {
  return decodeSpan([b], 0, 1).text;
}

/** Encode one editor unit (character or escape) to its machine byte(s). */
function encode(text: string): number[] {
  return parseChar(text, 0).codes;
}

describe('BBC charset totality', () => {
  it('round-trips every byte 0x00-0xFF through decode -> parse', () => {
    for (let b = 0; b <= 0xff; b++) {
      const text = decodeByte(b);
      expect(encode(text), `byte 0x${b.toString(16)} via ${text}`).toEqual([b]);
    }
  });

  it('escapes control codes 0x00-0x1F as {0xNN} (never dropped)', () => {
    for (const b of [0x00, 0x07, 0x0c, 0x1f]) {
      const hex = b.toString(16).padStart(2, '0').toUpperCase();
      expect(decodeByte(b)).toBe(`{0x${hex}}`);
      expect(encode(`{0x${hex}}`)).toEqual([b]);
    }
  });

  it('maps 0x7F both ways as a raw escape', () => {
    expect(decodeByte(0x7f)).toBe('{0x7F}');
    expect(encode('{0x7F}')).toEqual([0x7f]);
  });

  it('names the teletext control codes 0x80-0x9F', () => {
    expect(decodeByte(0x81)).toBe('{RED}');
    expect(decodeByte(0x8d)).toBe('{DOUBLE HEIGHT}');
    expect(decodeByte(0x97)).toBe('{GRAPHICS WHITE}');
    expect(encode('{RED}')).toEqual([0x81]);
    expect(encode('{DOUBLE HEIGHT}')).toEqual([0x8d]);
    // Names are matched case- and whitespace-insensitively.
    expect(encode('{double  height}')).toEqual([0x8d]);
  });

  it('every named teletext code round-trips', () => {
    for (const [code, name] of Object.entries(TELETEXT_NAMES)) {
      expect(decodeByte(Number(code))).toBe(`{${name}}`);
      expect(encode(`{${name}}`)).toEqual([Number(code)]);
    }
  });

  it('renders the MODE 7 mosaics 0xA1-0xBF / 0xE0-0xFF as sextants, both ways', () => {
    const mosaics = [];
    for (let b = 0xa1; b <= 0xbf; b++) mosaics.push(b);
    for (let b = 0xe0; b <= 0xff; b++) mosaics.push(b);
    for (const b of mosaics) {
      const text = decodeByte(b);
      expect(text, `0x${b.toString(16)}`).not.toMatch(/^\{0x/);
      expect(encode(text), `0x${b.toString(16)} via ${text}`).toEqual([b]);
      // The old {0xNN} spelling keeps loading and encodes to the same byte.
      const hex = b.toString(16).padStart(2, '0').toUpperCase();
      expect(encode(`{0x${hex}}`)).toEqual([b]);
    }
    // Spot-check the SAA5050 bit permutation (bottom-right is bit 6, not 5).
    expect(decodeByte(0xa1)).toBe('🬀'); // top-left only
    expect(decodeByte(0xe0)).toBe('🬞'); // bottom-right only (bit 6)
    expect(decodeByte(0xb5)).toBe('▌'); // left column
    expect(decodeByte(0xea)).toBe('▐'); // right column
    expect(decodeByte(0xff)).toBe('█'); // all six cells
  });

  it('keeps the blank mosaic 0xA0 and the blast-through capitals escaped', () => {
    // 0xA0 draws nothing; its only faithful text form would be a space.
    expect(decodeByte(0xa0)).toBe('{0xA0}');
    expect(encode('{0xA0}')).toEqual([0xa0]);
    // 0xC0-0xDF display as capital letters even in graphics mode (bit 5 is
    // the SAA5050's graphics flag, and theirs is clear).
    for (let b = 0xc0; b <= 0xdf; b++) {
      const hex = b.toString(16).padStart(2, '0').toUpperCase();
      expect(decodeByte(b)).toBe(`{0x${hex}}`);
      expect(encode(`{0x${hex}}`)).toEqual([b]);
    }
  });

  it('keeps a non-escape brace literal, and escapes a brace that would collide', () => {
    // "{X}" is not an escape: the '{' stays a literal 0x7B.
    expect(decodeSpan([0x7b, 0x58, 0x7d], 0, 3).text).toBe('{');
    // "{RED}" as literal bytes would be re-read as the escape, so escape the '{'.
    const red = [0x7b, ...[...'RED'].map((c) => c.charCodeAt(0)), 0x7d];
    expect(decodeSpan(red, 0, red.length).text).toBe('{0x7B}');
  });

  it('maps £ / backquote to 0x60 and back', () => {
    expect(Array.from(bbcCharset.toMachine('£'))).toEqual([0x60]);
    expect(Array.from(bbcCharset.toMachine('`'))).toEqual([0x60]);
    expect(bbcCharset.toUnicode([0x60])).toBe('£');
    expect(decodeByte(0x60)).toBe('£');
  });

  it('toUnicode/toMachine treat 0x0A/0x0D as newlines', () => {
    expect(bbcCharset.toUnicode([0x0a])).toBe('\n');
    expect(bbcCharset.toUnicode([0x0d])).toBe('\n');
    expect(Array.from(bbcCharset.toMachine('\n'))).toEqual([0x0a]);
  });

  it('rejects characters with no BBC equivalent', () => {
    expect(() => bbcCharset.toMachine('☺')).toThrow();
  });
});
