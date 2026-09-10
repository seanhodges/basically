// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { CharsetMapping } from '../types';

/**
 * Not implemented yet. The Sorcerer's character set is four bands - fixed graphics at
 * 0-31, ASCII at 32-127 (upper *and* lower case), the standard graphics set at
 * 128-191 and the user-definable set at 192-255 - and the last two live in
 * generator RAM, so their shapes come from the bitmaps the Monitor writes
 * rather than from a table anyone can author.
 */
export const sorcererCharset: CharsetMapping = {
  toMachine(_text: string): Uint8Array {
    throw new Error('sorcerer: charset not implemented');
  },
  toUnicode(_codes: ArrayLike<number>): string {
    throw new Error('sorcerer: charset not implemented');
  },
  glyph(_code: number): string {
    throw new Error('sorcerer: charset not implemented');
  },
};
