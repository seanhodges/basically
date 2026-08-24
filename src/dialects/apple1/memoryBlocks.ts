// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryBlocksSupport, MemoryRange } from '../types';
import { DEFAULT_HIMEM, DEFAULT_LOMEM } from './addresses';
import { declaredWorkspace } from './directLine';

/**
 * Machine-code blocks. The free ranges are narrow here: below LOMEM is the only
 * RAM a program does not need, because $1000-$DFFF is simply not fitted.
 *
 * The window is $0300-$07FF. It stops short of $0280 because the monitor
 * assembles a typed line at $0200-$027F and Integer BASIC crunches it there, so
 * a block reaching down into that page is overwritten by the next thing typed -
 * including the RUN that starts the program.
 *
 * The window is the free RAM below the *stock* LOMEM. A program that lowers
 * LOMEM claims part of it for the workspace, which is why {@link programArea}
 * reads the program's own bounds rather than assuming the stock ones.
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
function programArea(_programByteSize: number, source?: string): MemoryRange {
  // Only the unnumbered lines are read: this runs on every lint pass, and
  // tokenizing a whole program to learn two numbers would be far too much work
  // for a keystroke.
  const { lomem, himem } = source
    ? declaredWorkspace(source)
    : { lomem: DEFAULT_LOMEM, himem: DEFAULT_HIMEM };
  return { start: lomem, end: himem - 1 };
}

export const apple1MemoryBlocks: MemoryBlocksSupport = {
  cpu: '6502',
  validRanges: VALID_RANGES,
  reservedRanges: RESERVED_RANGES,
  programArea,
  defaultAddress: 0x0300,
};
