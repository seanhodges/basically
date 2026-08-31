// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryMap } from '../types';

/**
 * The 64K CPU address space: the BIOS and MSX BASIC ROMs in slot 0, the RAM
 * the machine fits, and the system variable area the standard puts at the top.
 *
 * The 16KB of video RAM is deliberately absent - it is a second address space
 * the CPU reaches only through VPOKE/VPEEK and the VDP's two ports, so tiling
 * it in here would tell a reader that a POKE can reach the screen.
 */
export const hb10pMemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  regions: [],
};
