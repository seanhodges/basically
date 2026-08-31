// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { decodeMsBasicFloat } from './microsoftBasicVars';

/**
 * The float format both 8080 Microsoft BASICs here store their numbers in.
 *
 * Pinned on its own, away from either machine, because the byte order is the
 * one thing about this decoder that is easy to write plausibly and wrongly: it
 * is the *reverse* of the Commodore five-byte float `emulator/c64/vars.ts`
 * decodes, so a reader who has just written that one has every reason to get
 * this backwards. The machine-level readback tests in each dialect prove the
 * table walk; this proves the arithmetic.
 */
describe('the Microsoft 8K BASIC four-byte float', () => {
  it('reads mantissa low-first, with the excess-129 exponent last', () => {
    expect(decodeMsBasicFloat([0x00, 0x00, 0x00, 0x81])).toBe(1);
    expect(decodeMsBasicFloat([0x00, 0x00, 0x20, 0x82])).toBe(2.5);
    expect(decodeMsBasicFloat([0x00, 0x00, 0x10, 0x84])).toBe(9);
    expect(decodeMsBasicFloat([0x00, 0x00, 0x00, 0x00])).toBe(0);
  });

  it('takes the sign from the mantissa bit the normalised 1 vacates', () => {
    // The top mantissa bit is always 1 in a normalised float, so the format
    // spends it on the sign and restores the 1 on the way out. +1 and -1 differ
    // in that bit alone.
    expect(decodeMsBasicFloat([0x00, 0x00, 0x80, 0x81])).toBe(-1);
    expect(decodeMsBasicFloat([0x00, 0x00, 0x60, 0x83])).toBe(7);
    expect(decodeMsBasicFloat([0x00, 0x00, 0xe0, 0x83])).toBe(-7);
  });

  it('reads at an offset, so an array element needs no copy', () => {
    const elements = [0x00, 0x00, 0x00, 0x81, 0x00, 0x00, 0x40, 0x81];
    expect(decodeMsBasicFloat(elements, 4)).toBe(1.5);
  });
});
