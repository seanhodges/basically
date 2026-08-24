// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryBlocksSupport, MemoryRange } from '../types';
import { DEFAULT_HIMEM, DEFAULT_LOMEM } from './addresses';

/**
 * Machine-code blocks. The free ranges are narrow here: below LOMEM is the only
 * RAM a program does not need, because $1000-$DFFF is simply not fitted.
 *
 * The window is $0300-$07FF. It stops short of $0280 because the monitor
 * assembles a typed line at $0200-$027F and Integer BASIC crunches it there, so
 * a block reaching down into that page is overwritten by the next thing typed -
 * including the RUN that starts the program.
 */
const VALID_RANGES: readonly MemoryRange[] = [{ start: 0x0300, end: 0x07ff }];

/** Nothing inside that window is claimed by anything else. */
const RESERVED_RANGES: readonly MemoryRange[] = [];

/**
 * The whole workspace, whatever the program's size.
 *
 * Every other machine here grows its program up from a fixed base and can say
 * where it ends. This one grows the program DOWN from HIMEM and the variables
 * UP from LOMEM, so the two ends of the region are occupied and the free space
 * is in the middle - a range from the base to "program plus slack" would name
 * the half of it that is guaranteed empty. LOMEM to HIMEM is the honest answer,
 * and it is why the block window has to be below LOMEM.
 */
function programArea(_programByteSize: number): MemoryRange {
  return { start: DEFAULT_LOMEM, end: DEFAULT_HIMEM - 1 };
}

export const apple1MemoryBlocks: MemoryBlocksSupport = {
  cpu: '6502',
  validRanges: VALID_RANGES,
  reservedRanges: RESERVED_RANGES,
  programArea,
  defaultAddress: 0x0300,
};
