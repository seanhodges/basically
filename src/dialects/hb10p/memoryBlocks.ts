// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryBlocksSupport, MemoryRange } from '../types';

/**
 * Where a user memory block may live on this machine, for the block linter.
 *
 * MSX BASIC hands out the RAM under HIMEM to itself, so a block needs either
 * space the interpreter never reaches or a HIMEM lowered by CLEAR before the
 * program runs. Both figures answer to the memory map.
 */
const VALID_RANGES: readonly MemoryRange[] = [];
const RESERVED_RANGES: readonly MemoryRange[] = [];

function programArea(_programByteSize: number): MemoryRange {
  throw new Error('hb10p: memory blocks not implemented');
}

export const hb10pMemoryBlocks: MemoryBlocksSupport = {
  cpu: 'z80',
  validRanges: VALID_RANGES,
  reservedRanges: RESERVED_RANGES,
  programArea,
  defaultAddress: 0,
};
