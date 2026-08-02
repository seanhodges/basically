// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { TokenizeError } from '../types';

/**
 * Editor text -> Altair 8K BASIC tokenized program bytes (Stage 1).
 *
 * The storage layout is the Microsoft linked-line format this project already
 * tokenizes twice (`commodore64/tokenizer.ts`, `trs80/tokenizer.ts`): each line
 * is `[u16 LE link to next line][u16 LE line number][tokenized body][0x00]`,
 * and a zero link terminates the program. Keywords become single high-bit
 * bytes; everything else is stored as its ASCII character.
 *
 * Two things differ from the siblings and must be derived, not copied: the
 * token byte for each keyword (see `keywords.ts`), and the program base the
 * link fields are computed against, which on the Altair sits above the
 * RAM-resident interpreter rather than at a fixed ROM-defined address (see
 * `addresses.ts`).
 *
 * Per project convention this collects {@link TokenizeError}s rather than
 * throwing, with 1-based lines and 0-based columns, and marks heuristic
 * statement-shape lint `fatal: false` so an imported-but-odd program still
 * builds a runnable image.
 */
export function tokenizeProgram(_source: string): {
  program: Uint8Array;
  errors: TokenizeError[];
} {
  throw new Error('altair8800: not implemented');
}
