// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryBlocksSupport, MemoryRange } from '../types';
import {
  PROGRAM_BASE,
  ROM_COMMAND_BASE,
  STACK_TOP,
  STRING_TOP,
  USER_CODE_BASE,
} from './addresses';

/**
 * Where a {@link import('../types').MemoryBlock} may live on the PMD 85, for
 * the block linter in `src/app/blockLint.ts`.
 *
 * `cpu: 'z80'` on an 8080 machine, for the reason `altair8800/memoryBlocks.ts`
 * spells out: the field's union has no `'8080'` member, 8080 assembly is a
 * strict subset of Z80 assembly, and the machine runs 8080 object code on the
 * vendored Z80 core - so any genuine 8080 routine assembles to the right bytes.
 * It does not mean there is a Z80 in the box.
 *
 * The two valid ranges are the only RAM a block can have. Everything else in
 * the bottom 32K belongs to something that is live while a program runs - the
 * interpreter copied down to 0x0000, its workspace at 0x5E00, its string pool
 * below 0x6F00 - and the top 32K is ROM, decoder holes and video RAM. A block
 * that reaches any of them is a hard "outside valid range" error rather than a
 * warning, which on this machine is the right severity: unlike a ROM machine
 * there is no hardware saying no, and a block that lands on the interpreter
 * takes BASIC-G down with it.
 */

/**
 * Headroom reserved beyond the raw tokenized program for the variables and
 * arrays that grow above it, which are not known until the program runs. The
 * same ~768-byte margin the Altair and the TRS-80 use.
 *
 * String data is not in it, and here that is exact rather than approximate:
 * BASIC-G keeps its strings in a region of their own well above the stack, so
 * they never push the program area upwards.
 */
const PROGRAM_AREA_SLACK_BYTES = 768;

/**
 * The program area, and the free RAM above the string pool.
 *
 * A block in the first competes with the program's own variables, which is what
 * {@link programArea} exists to warn about; a block in the second competes with
 * nothing at all, which is why {@link DEFAULT_ADDRESS} is there.
 */
const VALID_RANGES: readonly MemoryRange[] = [
  { start: PROGRAM_BASE, end: STACK_TOP },
  { start: STRING_TOP, end: USER_CODE_BASE - 1 },
];

/** See the note above: everything worth reserving is excluded, not discouraged. */
const RESERVED_RANGES: readonly MemoryRange[] = [];

/**
 * Suggested address for a new block: the base of the free RAM above the string
 * pool, which is also where BASIC-G's own `ROM n` statement copies a module
 * block to and calls it - so it is the address this machine already treats as
 * "somewhere to put code".
 */
const DEFAULT_ADDRESS = ROM_COMMAND_BASE;

/**
 * The BASIC program area for a program tokenized to `programByteSize` bytes:
 * from the program base, extended by {@link PROGRAM_AREA_SLACK_BYTES} to cover
 * the variables that follow it.
 */
function programArea(programByteSize: number): MemoryRange {
  const size = programByteSize + PROGRAM_AREA_SLACK_BYTES;
  return { start: PROGRAM_BASE, end: PROGRAM_BASE + size - 1 };
}

export const pmd85MemoryBlocks: MemoryBlocksSupport = {
  cpu: 'z80',
  validRanges: VALID_RANGES,
  reservedRanges: RESERVED_RANGES,
  programArea,
  defaultAddress: DEFAULT_ADDRESS,
};
