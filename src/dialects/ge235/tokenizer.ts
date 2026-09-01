// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { TokenizeError } from '../types';

/**
 * This machine had no tokenized program format: source was held as characters,
 * and each RUN compiled it. So "program bytes" here is the BCD-encoded source,
 * and tokenize/detokenize must be an exact round trip.
 */
export function tokenizeProgram(_source: string): {
  program: Uint8Array;
  errors: TokenizeError[];
} {
  throw new Error('ge235: not implemented');
}
