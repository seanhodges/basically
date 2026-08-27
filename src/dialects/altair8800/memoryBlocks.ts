// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryBlocksSupport, MemoryRange } from '../types';
import { PROGRAM_BASE, RAM_TOP } from './addresses';

/**
 * Where the Altair's {@link import('../types').Block}s may legally live,
 * for the block linter in `src/app/blockLint.ts`.
 *
 * Two things here are deliberate rather than obvious:
 *
 * 1. **`cpu: 'z80'` on an 8080 machine.** The field is typed `'z80' | '6502'`
 *    and there is no `'8080'`. Declaring `'z80'` is correct in the only sense
 *    that matters to a block: 8080 assembly is a strict subset of Z80 assembly,
 *    the machine executes 8080 object code on the vendored Z80 core, and the
 *    block assembler therefore assembles any genuine 8080 routine to the right
 *    bytes. Widening the union would ripple through every dialect for no
 *    behavioural gain. It does *not* mean the Altair has a Z80 in it: write
 *    Z80-only instructions in a block here and the machine will run them, but
 *    real hardware would not.
 *
 * 2. **Nothing is `reserved`, because everything worth reserving is below the
 *    valid range.** On every other machine the linter's soft warnings cover
 *    live state a block would clobber - screen memory, system workspace. Here
 *    that state is the RAM-resident interpreter at 0x0000-0x1938, which sits
 *    under {@link VALID_RANGES}'s floor, so a block that reaches it is a hard
 *    "outside valid range" error rather than a warning. That floor is the only
 *    thing protecting BASIC: unlike a ROM machine there is no hardware saying
 *    no.
 */

/**
 * Headroom reserved beyond the raw tokenized program for the variables and
 * arrays that grow above it, which are not known until the program runs. The
 * same conservative ~768-byte margin the TRS-80 uses, and for the same reason:
 * enough for a typical program's variables without rejecting blocks that would
 * comfortably fit above them.
 *
 * String *data* is not in here. 8K BASIC keeps its string pool at the top of
 * memory (50 bytes until a program says `CLEAR n`), not above the arrays, so it
 * does not push the program area upwards - see {@link DEFAULT_ADDRESS} for the
 * end of memory a block should stay clear of instead.
 */
const PROGRAM_AREA_SLACK_BYTES = 768;

/**
 * Everything from the program base to the top of the fitted memory boards. The
 * interpreter below 0x1939 and the empty backplane above {@link RAM_TOP} are
 * both outside it, which is what makes a block that lands in either an error.
 */
const VALID_RANGES: readonly MemoryRange[] = [
  { start: PROGRAM_BASE, end: RAM_TOP },
];

/** See the note above: the interpreter is excluded, not merely discouraged. */
const RESERVED_RANGES: readonly MemoryRange[] = [];

/**
 * Suggested address for a new block: 4K below the top of RAM, high enough to be
 * clear of any plausible BASIC program and its variables, low enough to leave
 * the string pool at the very top of memory room to grow downwards.
 */
const DEFAULT_ADDRESS = 0xb000;

/**
 * The BASIC program area for a program tokenized to `programByteSize` bytes:
 * from the program base, extended by {@link PROGRAM_AREA_SLACK_BYTES} past the
 * raw bytes to cover the variables that follow them.
 */
function programArea(programByteSize: number): MemoryRange {
  const size = programByteSize + PROGRAM_AREA_SLACK_BYTES;
  return { start: PROGRAM_BASE, end: PROGRAM_BASE + size - 1 };
}

export const altair8800MemoryBlocks: MemoryBlocksSupport = {
  cpu: 'z80',
  validRanges: VALID_RANGES,
  reservedRanges: RESERVED_RANGES,
  programArea,
  defaultAddress: DEFAULT_ADDRESS,
};
