import { describe, expect, it } from 'vitest';
import { parseChar, zx80Charset, QUOTE } from './charset';

/** Convenience: code for a single source character. */
const code = (ch: string) => parseChar(ch, 0).code;

describe('zx80 charset', () => {
  it('uses 0x01 for the string quote (not the ZX81 0x0B)', () => {
    expect(QUOTE).toBe(0x01);
    expect(code('"')).toBe(0x01);
  });

  it('maps punctuation to the ZX80 ROM-font codes', () => {
    // These differ from the ZX81 and only surface inside strings/REM.
    expect(code('-')).toBe(0x12);
    expect(code('+')).toBe(0x13);
    expect(code('*')).toBe(0x14);
    expect(code('/')).toBe(0x15);
    expect(code('=')).toBe(0x16);
    expect(code('>')).toBe(0x17);
    expect(code('<')).toBe(0x18);
    expect(code('£')).toBe(0x0c);
  });

  it('keeps digits and letters on the shared codes', () => {
    expect(code('0')).toBe(0x1c);
    expect(code('9')).toBe(0x25);
    expect(code('A')).toBe(0x26);
    expect(code('Z')).toBe(0x3f);
  });

  it('round-trips text through the machine codes', () => {
    const text = 'PRINT "A+B=C"';
    const codes = zx80Charset.toMachine(text);
    expect(zx80Charset.toUnicode(codes)).toBe(text);
  });

  it('inverts characters with the % prefix', () => {
    expect(code('%A')).toBe(0x26 | 0x80);
    expect(zx80Charset.glyph(0x26 | 0x80)).toBe('%A');
  });

  it('is total: every byte 0x00-0xFF round-trips through a text form', () => {
    for (let c = 0; c <= 0xff; c++) {
      const text = zx80Charset.toUnicode([c]);
      expect(
        Array.from(zx80Charset.toMachine(text)),
        `code 0x${c.toString(16)} -> ${JSON.stringify(text)}`,
      ).toEqual([c]);
    }
  });

  it('renders codes with no standard character as \\{NN} raw escapes', () => {
    expect(zx80Charset.toUnicode([0x7f])).toBe('\\{7F}');
    expect(zx80Charset.toUnicode([0xfe])).toBe('\\{FE}'); // REM token as data
    expect(Array.from(zx80Charset.toMachine('\\{C4}'))).toEqual([0xc4]);
    expect(Array.from(zx80Charset.toMachine('\n'))).toEqual([0x76]);
  });
});
