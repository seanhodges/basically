// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { DetokenizeResult } from '../types';

/**
 * The MSX `.bas` container: a 0xFF marker byte followed by the tokenized
 * program exactly as it sits in memory from TXTTAB. A file starting with any
 * other byte is an ASCII listing, which loads by a different route.
 */
export const BAS_TOKENIZED_MARKER = 0xff;

/** Wrap tokenized program bytes as a loadable `.bas` image. */
export function buildBasFile(_programBytes: Uint8Array): Uint8Array {
  throw new Error('hb10p: .bas builder not implemented');
}

/** Read a `.bas` image back, relinking the lines to the program base. */
export function importBasFile(_image: Uint8Array): DetokenizeResult {
  throw new Error('hb10p: .bas import not implemented');
}
