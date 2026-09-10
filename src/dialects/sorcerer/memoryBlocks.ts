// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryBlocksSupport, MemoryRange } from '../types';

/**
 * Where a document's machine-code blocks may live. Not populated yet.
 *
 * Needed before the samples can load, despite reading like a memory-map
 * concern: `kaleido.bas` carries its routine as a memory block, and
 * `src/app/sampleBlocks.ts` refuses to assemble one for a dialect that declares
 * no `memoryBlocks`, so the sample cannot load without this. What it owes is a
 * `defaultAddress` in RAM that neither the Monitor workarea nor BASIC touches,
 * and `validRanges` wide enough to hold the routine there.
 */
export const sorcererMemoryBlocks: MemoryBlocksSupport = {
  cpu: 'z80',
  validRanges: [] as readonly MemoryRange[],
  reservedRanges: [] as readonly MemoryRange[],
  programArea(_programByteSize: number): MemoryRange {
    throw new Error('sorcerer: memory blocks not implemented');
  },
  defaultAddress: 0,
};
