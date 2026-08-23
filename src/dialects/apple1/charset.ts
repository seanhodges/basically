// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { type CharsetMapping } from '../types';

/**
 * The Apple I's 64-glyph character set: upper case, digits and punctuation,
 * held on the machine with bit 7 set. There are no graphics characters at all,
 * which is why this dialect ships no graphics palette and records an empty
 * range in SEMIGRAPHIC_CODES.
 */
export const apple1Charset: CharsetMapping = {
  toMachine(_text: string): Uint8Array {
    throw new Error('apple1: not implemented');
  },
  toUnicode(_codes: ArrayLike<number>): string {
    throw new Error('apple1: not implemented');
  },
  glyph(_code: number): string {
    throw new Error('apple1: not implemented');
  },
};
