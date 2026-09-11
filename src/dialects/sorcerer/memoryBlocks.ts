// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryBlocksSupport, MemoryRange } from '../types';
import {
  MONITOR_RAM_TAIL_BYTES,
  PROGRAM_BASE,
  RAM_BASE,
  RAM_FITTED_BYTES,
} from './addresses';

/**
 * Where a document's machine-code {@link import('../types').Block}s may live,
 * for the block linter in `src/app/blockLint.ts`.
 *
 * Three things here are deliberate rather than obvious:
 *
 *  1. **`cpu: 'z80'` means what it says on this machine.** The Sorcerer really
 *     is a Z80, so unlike the Altair and the PMD 85 - which declare `'z80'`
 *     because the union has no `'8080'` member - a block here may use the
 *     instructions the letter promises.
 *  2. **Nothing is `reserved`, because everything worth reserving is outside
 *     the valid range.** Below {@link PROGRAM_BASE} sit the interpreter's
 *     control area and its workspace pointers, and above the top of fitted RAM
 *     sit the ROM PAC, the Monitor, its workarea, the screen and the character
 *     generator. A block that reaches any of them is a hard "outside valid
 *     range" error rather than a warning, which is the right severity for the
 *     first group: there is no hardware saying no, and a block that lands on
 *     the control area takes BASIC down with it.
 *  3. **The ceiling is the top of fitted RAM less the Monitor's own tail.** The
 *     Monitor claims {@link MONITOR_RAM_TAIL_BYTES} bytes at the top of
 *     whatever RAM it found, which is also what keeps the BASIC program area
 *     clear of it.
 */

/**
 * Headroom reserved beyond the raw tokenized program for the variables and
 * arrays that grow above it, which are not known until the program runs. The
 * same ~768-byte margin the Altair, the TRS-80 and the PMD 85 use.
 *
 * String data is not in it: this is a Microsoft 8K BASIC, so the string pool
 * lives at the top of memory rather than above the arrays and does not push the
 * program area upwards. What it does instead is grow *downwards* towards a
 * block, which is why {@link DEFAULT_ADDRESS} is nowhere near the ceiling.
 */
const PROGRAM_AREA_SLACK_BYTES = 768;

/** The last byte of RAM BASIC and a block can use; above it is the Monitor's. */
const RAM_TOP = RAM_BASE + RAM_FITTED_BYTES - MONITOR_RAM_TAIL_BYTES - 1;

/**
 * Everything from the program base to the top of usable RAM. The control area
 * below {@link PROGRAM_BASE} and the whole top half of the address map are both
 * outside it.
 */
const VALID_RANGES: readonly MemoryRange[] = [
  { start: PROGRAM_BASE, end: RAM_TOP },
];

/** See the note above: the interpreter's own RAM is excluded, not discouraged. */
const RESERVED_RANGES: readonly MemoryRange[] = [];

/**
 * Suggested address for a new block: 4K below the top of RAM, high enough to be
 * clear of any plausible BASIC program and its variables, low enough to leave
 * the string pool at the very top of memory room to grow downwards.
 *
 * It is also small enough to `POKE` in decimal without explaining two's
 * complement first, which matters here: this interpreter takes a signed 16-bit
 * address, so anything from 32768 up has to be written as a negative number and
 * the positive form is a hard `?FC ERROR`.
 */
const DEFAULT_ADDRESS = 0x7000;

/**
 * The BASIC program area for a program tokenized to `programByteSize` bytes:
 * from the program base, extended by {@link PROGRAM_AREA_SLACK_BYTES} to cover
 * the variables that follow it.
 */
function programArea(programByteSize: number): MemoryRange {
  const size = programByteSize + PROGRAM_AREA_SLACK_BYTES;
  return { start: PROGRAM_BASE, end: PROGRAM_BASE + size - 1 };
}

export const sorcererMemoryBlocks: MemoryBlocksSupport = {
  cpu: 'z80',
  validRanges: VALID_RANGES,
  reservedRanges: RESERVED_RANGES,
  programArea,
  defaultAddress: DEFAULT_ADDRESS,
};
