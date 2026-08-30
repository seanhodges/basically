// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryMap } from '../types';

/**
 * The Apple II Plus's regions. The hardware half matches the sibling's; the
 * `$D000`-`$F7FF` interpreter and the zero-page workspace do not, which is why
 * this is written rather than imported.
 */
export const apple2plusMemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  regions: [],
};
