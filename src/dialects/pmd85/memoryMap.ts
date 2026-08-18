// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryMap } from '../types';

/**
 * The normal (post-boot) memory configuration: RAM 0x0000-0x7FFF, the Monitor
 * at 0x8000-0x8FFF with its mirror at 0xA000-0xAFFF, and video RAM filling
 * 0xC000-0xFFFF. The regions are still to be written out, including the holes
 * at 0x9000-0x9FFF and 0xB000-0xBFFF.
 */
export const pmd85MemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  regions: [],
};
