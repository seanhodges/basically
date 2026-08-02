// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { CharsetMapping } from '../types';

/**
 * The Altair 8800's character set - the simplest in the project, because the
 * machine has none of its own.
 *
 * There is no video hardware and no character generator: BASIC writes bytes to
 * a serial port and whatever terminal is plugged in decides what they look
 * like. So the mapping is plain 7-bit ASCII, with no block graphics, no
 * inverse-video range and no PETSCII-style reordering - the one dialect here
 * whose charset carries no pictures at all.
 *
 * It must still be **total and injective**, which is what
 * `src/dialects/charsetProbes.test.ts` enforces once the dialect is registered:
 * every byte 0x00-0xFF needs exactly one text form, and that form must encode
 * back to the same byte. Stage 1 gets there with printable ASCII (0x20-0x7E)
 * as itself, and control codes plus the unused top-bit range 0x80-0xFF as
 * `{0xNN}` raw escapes - the braced style the TRS-80 and BBC charsets use.
 *
 * Because nothing outside ASCII is ever emitted, this dialect adds no
 * codepoints to the bundled font subsets and `src/dialects/fontCoverage.test.ts`
 * needs no new glyphs for it.
 */

/**
 * Parse the single character/escape starting at `i`, returning its machine byte
 * and how many source characters it consumed. Mirrors the signature the other
 * dialects' charsets expose, since `charsetProbes.ts` drives them generically.
 */
export function parseChar(
  _text: string,
  _i: number,
): { code: number; length: number } | undefined {
  throw new Error('altair8800: not implemented');
}

/** Decode `length` bytes from `codes` at `i` into their canonical text form. */
export function decodeSpan(
  _codes: ArrayLike<number>,
  _i: number,
  _length: number,
): { text: string; length: number } {
  throw new Error('altair8800: not implemented');
}

export const altair8800Charset: CharsetMapping = {
  toMachine(_text: string): Uint8Array {
    throw new Error('altair8800: not implemented');
  },
  toUnicode(_codes: ArrayLike<number>): string {
    throw new Error('altair8800: not implemented');
  },
  glyph(_code: number): string {
    throw new Error('altair8800: not implemented');
  },
};
