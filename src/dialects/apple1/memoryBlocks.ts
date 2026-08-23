// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryBlocksSupport } from '../types';

/**
 * Machine-code blocks. The free ranges are narrow here: below LOMEM is the only
 * RAM a program does not need, because $1000-$DFFF is simply not fitted.
 */
export const apple1MemoryBlocks: MemoryBlocksSupport = {
  cpu: '6502',
  validRanges: [],
  reservedRanges: [],
  programArea(_programByteSize: number) {
    throw new Error('apple1: not implemented');
  },
  defaultAddress: 0x0300,
};
