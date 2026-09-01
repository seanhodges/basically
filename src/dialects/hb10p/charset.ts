// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { CharsetMapping } from '../types';

/**
 * The MSX International character set, as the character generator in the BIOS
 * ROM defines it.
 *
 * One encoding quirk has to survive both directions: the graphic characters
 * the GRAPH key produces are stored in a string as a 0x01 header byte followed
 * by the character plus 0x40, so a single screen glyph is two bytes of program
 * text.
 */
export const hb10pCharset: CharsetMapping = {
  toMachine(_text: string): Uint8Array {
    throw new Error('hb10p: charset not implemented');
  },
  toUnicode(_codes: ArrayLike<number>): string {
    throw new Error('hb10p: charset not implemented');
  },
  glyph(_code: number): string {
    throw new Error('hb10p: charset not implemented');
  },
};
