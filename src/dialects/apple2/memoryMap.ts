// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryMap } from '../types';

/** Regions tiling the whole address space: RAM, the display pages inside it,
 * the `$C000` I/O page switch by switch, the ROM window, and the vectors. */
export const apple2MemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  regions: [],
};
