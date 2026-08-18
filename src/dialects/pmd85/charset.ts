// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { CharsetMapping } from '../types';

/**
 * The PMD 85 character set.
 *
 * The machine is Czech/Slovak, so the accented letters belong to the set rather
 * than extending it; how each is spelled in editor text has to be settled
 * against a ROM font dump.
 */
export const pmd85Charset: CharsetMapping = {
  toMachine(_text: string): Uint8Array {
    throw new Error('pmd85: not implemented');
  },
  toUnicode(_codes: ArrayLike<number>): string {
    throw new Error('pmd85: not implemented');
  },
  glyph(_code: number): string {
    throw new Error('pmd85: not implemented');
  },
};
