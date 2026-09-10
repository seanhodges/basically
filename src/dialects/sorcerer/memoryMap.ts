// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryMap } from '../types';

/**
 * The Sorcerer's memory map for the memory-map viewer. Not populated yet.
 *
 * `regions` must tile the whole 64K, and its program region has to agree with
 * `memoryBlocks.programArea` - `memoryMapDetail.test.ts` pins the two together.
 * The addresses are in `addresses.ts`; the shape of the map is what this file
 * owes.
 */
export const sorcererMemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  regions: [],
};
