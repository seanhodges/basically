// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { TokenizeError } from '../types';

/**
 * Text to the bytes the interpreter stores.
 *
 * A parser rather than a scanner, because a keyword's token records which
 * grammar rule matched it.
 */
export function tokenizeProgram(_source: string): {
  program: Uint8Array;
  errors: TokenizeError[];
} {
  throw new Error('apple2: not implemented');
}
