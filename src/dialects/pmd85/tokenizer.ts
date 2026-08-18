// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { TokenizeError } from '../types';

/**
 * Source text to BASIC-G program bytes. Collects {@link TokenizeError}s for
 * inline display rather than throwing, like every other dialect here.
 */
export function tokenizeProgram(_source: string): {
  program: Uint8Array;
  errors: TokenizeError[];
} {
  throw new Error('pmd85: not implemented');
}
