// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { TokenizeError } from '../types';

export function tokenizeProgram(_source: string): {
  program: Uint8Array;
  errors: TokenizeError[];
} {
  throw new Error('apple2plus: not implemented');
}
