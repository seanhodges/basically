// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { CharsetMapping } from '../types';
import { atasciiToText, parseAtariChar } from './atascii';

/**
 * Atari ATASCII <-> editor text, for the bytes a BASIC program stores: string
 * literals, REM/DATA text, and any character that is not part of a token.
 *
 * The complete 256-code table lives in {@link ./atascii}; this module is the
 * thin {@link CharsetMapping} adapter over it. Unlike the Commodore machines
 * the Atari has both letter cases in one character set, so nothing is folded.
 */
export const atariCharset: CharsetMapping = {
  toMachine(text: string): Uint8Array {
    const out: number[] = [];
    let i = 0;
    while (i < text.length) {
      const { code, length } = parseAtariChar(text, i);
      out.push(code);
      i += length;
    }
    return Uint8Array.from(out);
  },

  toUnicode(codes: ArrayLike<number>): string {
    let text = '';
    for (let i = 0; i < codes.length; i++) text += atasciiToText(codes[i]!);
    return text;
  },

  glyph(code: number): string {
    return atasciiToText(code);
  },
};
