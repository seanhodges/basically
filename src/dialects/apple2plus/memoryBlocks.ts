// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryBlocksSupport, MemoryRange } from '../types';

/**
 * RAM a machine-code block can occupy. Applesoft and the Autostart Monitor
 * between them claim more of the low pages than the sibling's Integer BASIC
 * does, so this window is checked against this interpreter rather than copied.
 */
const VALID_RANGES: readonly MemoryRange[] = [];

const RESERVED_RANGES: readonly MemoryRange[] = [];

function programArea(_programByteSize: number, _source?: string): MemoryRange {
  throw new Error('apple2plus: not implemented');
}

export const apple2plusMemoryBlocks: MemoryBlocksSupport = {
  cpu: '6502',
  validRanges: VALID_RANGES,
  reservedRanges: RESERVED_RANGES,
  programArea,
  defaultAddress: 0x0300,
};
