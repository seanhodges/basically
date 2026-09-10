// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { TokenizeResult } from '../types';

/**
 * Editor text -> tokenized Exidy Standard BASIC program bytes.
 * Not implemented yet.
 */
export function tokenizeProgram(
  _source: string,
  _opts?: { programName?: string },
): TokenizeResult {
  throw new Error('sorcerer: tokenizer not implemented');
}
