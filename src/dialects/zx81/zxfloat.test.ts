import { describe, expect, it } from 'vitest';
import {
  decodeZxFloat,
  encodeZxFloat,
  floatOverrideNotation,
  parseFloatOverride,
} from './zxfloat';

const hex = (b: Uint8Array) =>
  Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(' ');

describe('encodeZxFloat', () => {
  it('matches the ROM bytes for a corpus of literals', () => {
    // These 5-byte forms are the exact values the ZX81/Spectrum ROM stores
    // (documented in the ROM disassembly); they pin encodeZxFloat to the real
    // hardware rather than to itself.
    const rom: Array<[number, string]> = [
      [0, '00 00 00 00 00'],
      [0.5, '80 00 00 00 00'],
      [1, '81 00 00 00 00'],
      [2, '82 00 00 00 00'],
      [3, '82 40 00 00 00'],
      [4, '83 00 00 00 00'],
      [10, '84 20 00 00 00'],
      [100, '87 48 00 00 00'],
      [1000, '8a 7a 00 00 00'],
      [32768, '90 00 00 00 00'],
      [65535, '90 7f ff 00 00'],
      [-1, '81 80 00 00 00'],
      [-0.5, '80 80 00 00 00'],
    ];
    for (const [n, bytes] of rom) {
      expect(hex(encodeZxFloat(n)), `${n}`).toBe(bytes);
    }
  });

  it('round-trips assorted values', () => {
    for (const n of [
      1, -1, 0.1, 3.14159265, 9999, 16514, 0.001, 1e10, -42.5, 65535,
    ]) {
      const decoded = decodeZxFloat(encodeZxFloat(n));
      expect(Math.abs(decoded - n)).toBeLessThanOrEqual(Math.abs(n) * 2 ** -31);
    }
  });

  it('rejects out-of-range values', () => {
    expect(() => encodeZxFloat(Infinity)).toThrow();
    expect(() => encodeZxFloat(1e40)).toThrow();
  });
});

describe('float override notation', () => {
  it('renders a canonical float as its decimal value', () => {
    const stored = encodeZxFloat(9999);
    expect(floatOverrideNotation(stored)).toBe('\\{=9999}');
  });

  it('falls back to raw bytes for a non-canonical float', () => {
    // A zero exponent with a non-zero mantissa: the ROM decodes it as 0, but
    // re-encoding 0 loses the mantissa bytes, so no decimal reproduces it.
    const stored = Uint8Array.from([0x00, 0x12, 0x34, 0x56, 0x78]);
    const notation = floatOverrideNotation(stored);
    expect(notation).toMatch(/^\\\{=\$[0-9A-F]{10}\}$/);
    const parsed = parseFloatOverride(notation, 0);
    expect(parsed).not.toBeNull();
    expect(parsed!.bytes).toEqual(Array.from(stored));
  });

  it('parses decimal and raw-byte overrides', () => {
    expect(parseFloatOverride('\\{=9999}', 0)!.bytes).toEqual(
      Array.from(encodeZxFloat(9999)),
    );
    expect(parseFloatOverride('\\{=$8420000000}', 0)!.bytes).toEqual([
      0x84, 0x20, 0x00, 0x00, 0x00,
    ]);
    expect(parseFloatOverride('\\{7F}', 0)).toBeNull(); // a raw byte, not an override
    expect(parseFloatOverride('\\{=bad}', 0)).toBeNull();
  });
});
