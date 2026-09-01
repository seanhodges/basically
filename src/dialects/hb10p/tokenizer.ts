// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { TokenizeError } from '../types';

/**
 * MSX BASIC text to program bytes.
 *
 * A line is a link word, a line-number word, the tokens, and a zero; the
 * program ends with a zero link. Numeric constants are typed rather than
 * spelled out - a one-byte prefix says octal, hex, line number, small integer,
 * two-byte integer, single or double float - and getting that table right is
 * most of what this file is.
 */
export function tokenizeProgram(_source: string): {
  bytes: Uint8Array;
  errors: TokenizeError[];
} {
  throw new Error('hb10p: tokenizer not implemented');
}
