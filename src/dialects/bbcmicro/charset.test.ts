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

  it('escapes unnamed top-bit bytes 0xA0-0xFF as {0xNN}', () => {
    expect(decodeByte(0xa0)).toBe('{0xA0}');
    expect(decodeByte(0xff)).toBe('{0xFF}');
    expect(encode('{0xA0}')).toEqual([0xa0]);
    expect(encode('{0xFF}')).toEqual([0xff]);
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
    expect(() => bbcCharset.toMachine('█')).toThrow();
  });
});
