// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  ATARI_FLOAT_MAX,
  fromAtariFloat,
  isRepresentable,
  toAtariFloat,
} from './bcd';

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16));

describe('Atari 6-byte BCD float', () => {
  it('stores zero as six zero bytes', () => {
    expect([...toAtariFloat(0)]).toEqual([0, 0, 0, 0, 0, 0]);
    expect(fromAtariFloat(new Uint8Array(6))).toBe(0);
  });

  // The exponent is a power of 100, so 1 and 10 share it and 100 is the next
  // one up - the property that makes the mantissa's leading zero necessary.
  it.each([
    [1, [0x40, 0x01, 0, 0, 0, 0]],
    [10, [0x40, 0x10, 0, 0, 0, 0]],
    [100, [0x41, 0x01, 0, 0, 0, 0]],
    [0.5, [0x3f, 0x50, 0, 0, 0, 0]],
    [3.14159265, [0x40, 0x03, 0x14, 0x15, 0x92, 0x65]],
    [-1, [0xc0, 0x01, 0, 0, 0, 0]],
  ])('encodes %p', (value, expected) => {
    expect(hex(toAtariFloat(value))).toEqual(
      hex(Uint8Array.from(expected as number[])),
    );
  });

  it('round-trips the values a listing can spell', () => {
    const values = [
      1, -1, 0.5, 2, 3, 10, 100, 255, 256, 1000, 32767, 65535, 0.1, 0.25, 1e-9,
      1e9, 123.456, -0.001, 99999.9999, 62.83185307,
    ];
    for (const value of values) {
      expect(fromAtariFloat(toAtariFloat(value))).toBe(value);
    }
  });

  // The exponent steps in powers of 100, so the mantissa's decimal point falls
  // between byte pairs and only an even power of ten is reachable. A value
  // needing all ten digits at an odd power - 99999.99999 is 9999999999e-5 -
  // therefore has no exact form and rounds, even though ten digits would hold
  // it. The neighbouring even power, 99999.9999, is exact.
  it('rounds a ten-digit mantissa that lands on an odd power of ten', () => {
    expect(fromAtariFloat(toAtariFloat(99999.99999))).toBe(100000);
    expect(fromAtariFloat(toAtariFloat(99999.9999))).toBe(99999.9999);
  });

  it('rounds to the format’s ten significant digits', () => {
    // 1/3 has no ten-digit decimal form, so it comes back rounded, not equal.
    const third = fromAtariFloat(toAtariFloat(1 / 3));
    expect(third).toBe(0.3333333333);
  });

  it('keeps the mantissa normalised so byte 1 is never zero', () => {
    for (const value of [1, 9, 10, 99, 100, 0.01, 0.99, 12345, 1e-30, 1e30]) {
      expect(toAtariFloat(value)[1]).not.toBe(0);
    }
  });

  it('rejects values outside the format’s range', () => {
    expect(isRepresentable(0)).toBe(true);
    expect(isRepresentable(ATARI_FLOAT_MAX)).toBe(true);
    expect(isRepresentable(1e99)).toBe(false);
    expect(isRepresentable(Infinity)).toBe(false);
    expect(isRepresentable(NaN)).toBe(false);
    expect(() => toAtariFloat(1e99)).toThrow();
  });

  it('reports a mantissa nibble above 9 as not a float', () => {
    expect(fromAtariFloat([0x40, 0x0a, 0, 0, 0, 0])).toBeNull();
    expect(fromAtariFloat([0x40, 0x01, 0, 0, 0])).toBeNull();
  });
});
