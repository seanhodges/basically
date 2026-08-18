// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryBlocksSupport, MemoryRange } from '../types';

/**
 * Machine-code block support.
 *
 * `cpu: 'z80'` because the union has no `'8080'` member and 8080 assembly is a
 * strict subset of Z80 assembly - the same reasoning `altair8800/memoryBlocks.ts`
 * records. The ranges are not established yet.
 */
export const pmd85MemoryBlocks: MemoryBlocksSupport = {
  cpu: 'z80',
  validRanges: [],
  reservedRanges: [],
  programArea(_programByteSize: number): MemoryRange {
    throw new Error('pmd85: not implemented');
  },
  defaultAddress: 0,
};
