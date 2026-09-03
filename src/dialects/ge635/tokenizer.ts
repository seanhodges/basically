// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { TokenizeError } from '../types';

/** Source text to the paper tape the Teletype punched. Not written yet. */
export function tokenizeProgram(_source: string): {
  program: Uint8Array;
  image: Uint8Array;
  errors: TokenizeError[];
} {
  throw new Error('ge635: tokenizer not implemented');
}
