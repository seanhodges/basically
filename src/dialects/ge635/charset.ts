// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { CharsetMapping } from '../types';

/**
 * The GE-635's character codes, which are **ASCII** rather than the GE-235's
 * six-bit BCD.
 *
 * The manual settles it twice over. Section 2.7's CHANGE table gives space as
 * 32, `!` as 33 and so on up, and its text says "A(1) is 65 - the BASIC code
 * number for A". Section 2.9's size rule counts a program's characters as
 * `C/4`, which packs four to a thirty-six-bit word and so makes each nine bits
 * wide; six-bit BCD would pack six.
 *
 * Not written yet.
 */
export const ge635Charset: CharsetMapping = {
  toMachine(_text: string): Uint8Array {
    throw new Error('ge635: charset not implemented');
  },
  toUnicode(_codes: ArrayLike<number>): string {
    throw new Error('ge635: charset not implemented');
  },
  glyph(_code: number): string {
    throw new Error('ge635: charset not implemented');
  },
};
