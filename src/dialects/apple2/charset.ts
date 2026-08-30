// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { type CharsetMapping } from '../types';

/**
 * The Apple II's character set: the Signetics 2513's 64 glyphs, upper case only,
 * and no pictures - plus the display encoding the Apple I has no equivalent of,
 * where a byte's top two bits pick normal, flashing or inverse video for the
 * same glyph.
 *
 * A property of the machine rather than of its BASIC, so `apple2plus` imports
 * this rather than deriving its own.
 */
export const apple2Charset: CharsetMapping = {
  toMachine(_text: string): Uint8Array {
    throw new Error('apple2: not implemented');
  },
  toUnicode(_codes: ArrayLike<number>): string {
    throw new Error('apple2: not implemented');
  },
  glyph(_code: number): string {
    throw new Error('apple2: not implemented');
  },
};
