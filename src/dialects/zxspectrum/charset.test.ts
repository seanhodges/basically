import { describe, expect, it } from 'vitest';
import { spectrumCharset } from './charset';
import { CharsetError } from '../types';

describe('zxspectrum charset', () => {
  it('maps ASCII printable characters directly', () => {
    expect(Array.from(spectrumCharset.toMachine('Ab9 !'))).toEqual([
      0x41, 0x62, 0x39, 0x20, 0x21,
    ]);
  });

  it('substitutes ↑, £ and © for their Spectrum codes', () => {
    expect(Array.from(spectrumCharset.toMachine('↑£©'))).toEqual([
      0x5e, 0x60, 0x7f,
    ]);
    expect(spectrumCharset.toUnicode([0x5e, 0x60, 0x7f])).toBe('↑£©');
  });

  it('accepts ^ and ` as aliases for ↑ and £', () => {
    expect(Array.from(spectrumCharset.toMachine('^`'))).toEqual([0x5e, 0x60]);
  });

  it('maps block-graphics unicode to codes 0x80-0x8F', () => {
    expect(Array.from(spectrumCharset.toMachine('█▌▀'))).toEqual([
      0x8f, 0x85, 0x83,
    ]);
    expect(spectrumCharset.toUnicode([0x8f, 0x85, 0x83])).toBe('█▌▀');
  });

  it('throws CharsetError on characters outside the set', () => {
    expect(() => spectrumCharset.toMachine('€')).toThrow(CharsetError);
  });

  it('maps \\a-\\u UDG escapes to 0x90-0xA4, lowercase on output', () => {
    expect(Array.from(spectrumCharset.toMachine('\\a\\u'))).toEqual([
      0x90, 0xa4,
    ]);
    expect(Array.from(spectrumCharset.toMachine('\\A\\S'))).toEqual([
      0x90, 0xa2,
    ]);
    expect(spectrumCharset.toUnicode([0x90, 0xa2, 0xa4])).toBe('\\a\\s\\u');
  });

  it('handles literal backslashes and rejects unknown escapes', () => {
    expect(Array.from(spectrumCharset.toMachine('\\\\'))).toEqual([0x5c]);
    expect(spectrumCharset.toUnicode([0x5c])).toBe('\\\\');
    expect(() => spectrumCharset.toMachine('\\z')).toThrow(CharsetError);
  });

  it('round-trips control-code directives', () => {
    expect(Array.from(spectrumCharset.toMachine('{INK 2}{PAPER 7}'))).toEqual([
      0x10, 0x02, 0x11, 0x07,
    ]);
    expect(Array.from(spectrumCharset.toMachine('{AT 5,3}'))).toEqual([
      0x16, 0x05, 0x03,
    ]);
    expect(Array.from(spectrumCharset.toMachine('{TAB 4}'))).toEqual([
      0x17, 0x04, 0x00,
    ]);
    expect(spectrumCharset.toUnicode([0x12, 0x01])).toBe('{FLASH 1}');
    expect(spectrumCharset.toUnicode([0x16, 0x05, 0x03])).toBe('{AT 5,3}');
    expect(spectrumCharset.toUnicode([0x17, 0x04, 0x01])).toBe('{TAB 260}');
  });

  it('accepts directive names case-insensitively', () => {
    expect(Array.from(spectrumCharset.toMachine('{ink 2}'))).toEqual([
      0x10, 0x02,
    ]);
    expect(Array.from(spectrumCharset.toMachine('{at 1,2}'))).toEqual([
      0x16, 0x01, 0x02,
    ]);
  });

  it('round-trips raw byte escapes for anything else', () => {
    expect(Array.from(spectrumCharset.toMachine('{0x0E}'))).toEqual([0x0e]);
    expect(Array.from(spectrumCharset.toMachine('{0xff}'))).toEqual([0xff]);
    expect(spectrumCharset.toUnicode([0x0e])).toBe('{0x0E}');
    expect(spectrumCharset.toUnicode([0x08])).toBe('{0x08}');
  });

  it('treats non-directive braces as literal text', () => {
    expect(Array.from(spectrumCharset.toMachine('{hello}'))).toEqual([
      0x7b, 0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x7d,
    ]);
    expect(spectrumCharset.toUnicode([0x7b, 0x68, 0x69, 0x7d])).toBe('{hi}');
  });

  it('escapes a literal { that would read back as a directive', () => {
    // "{INK 2}" as literal bytes must not come back as the control sequence.
    const literal = [0x7b, 0x49, 0x4e, 0x4b, 0x20, 0x32, 0x7d];
    const text = spectrumCharset.toUnicode(literal);
    expect(text).toBe('{0x7B}INK 2}');
    expect(Array.from(spectrumCharset.toMachine(text))).toEqual(literal);
  });

  it('emits a raw escape for a control byte with truncated operands', () => {
    expect(spectrumCharset.toUnicode([0x10])).toBe('{0x10}');
    expect(spectrumCharset.toUnicode([0x16, 0x05])).toBe('{0x16}{0x05}');
  });

  it('round-trips every code 0x00-0xA4 byte-exactly', () => {
    const codes: number[] = [];
    for (let c = 0; c <= 0xa4; c++) {
      if (c === 0x0d) continue; // ENTER renders as newline, not round-tripped
      if (c === 0x80) continue; // blank graphic renders as a plain space
      codes.push(c);
    }
    const text = spectrumCharset.toUnicode(codes);
    expect(Array.from(spectrumCharset.toMachine(text))).toEqual(codes);
  });
});
