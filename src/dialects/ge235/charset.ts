// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { CharsetMapping } from '../types';

/**
 * The GE-235 stored three 6-bit BCD characters to a 20-bit word, in the low 18
 * bits. The code table is known exactly: it was recovered by solving the 1965
 * compiler image's own text constants, which admitted exactly one consistent
 * answer across the whole image.
 */
export const ge235Charset: CharsetMapping = {
  toMachine(_text: string): Uint8Array {
    throw new Error('ge235: not implemented');
  },
  toUnicode(_codes: ArrayLike<number>): string {
    throw new Error('ge235: not implemented');
  },
  glyph(_code: number): string {
    throw new Error('ge235: not implemented');
  },
};
