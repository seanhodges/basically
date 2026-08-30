// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryBlocksSupport, MemoryRange } from '../types';

/** RAM a machine-code block can occupy: free of the ROM, the interpreter's
 * workspace, the display pages and the monitor's own scratch. */
const VALID_RANGES: readonly MemoryRange[] = [];

const RESERVED_RANGES: readonly MemoryRange[] = [];

function programArea(_programByteSize: number, _source?: string): MemoryRange {
  throw new Error('apple2: not implemented');
}

export const apple2MemoryBlocks: MemoryBlocksSupport = {
  cpu: '6502',
  validRanges: VALID_RANGES,
  reservedRanges: RESERVED_RANGES,
  programArea,
  defaultAddress: 0x0300,
};
