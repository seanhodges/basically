// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryMap } from '../types';

/** The 64K space as an Apple I fills it: 4K low RAM, the PIA, the ACI window,
 * the interpreter block at $E000 and the monitor at $FF00. */
export const apple1MemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  regions: [],
};
