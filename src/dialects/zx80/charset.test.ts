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
});
