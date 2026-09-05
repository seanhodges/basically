// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryBlocksSupport, MemoryRange } from '../types';
import { TXTTAB } from './addresses';

/**
 * Where a user memory block may live on this machine, for the block linter.
 *
 * MSX BASIC hands out the RAM under HIMEM to itself, so a block needs either
 * space the interpreter never reaches or a HIMEM lowered by CLEAR before the
 * program runs. Both figures answer to the memory map.
 *
 * Only the top 32KB of the address space is RAM here: the BIOS answers at
 * 0x0000 and MSX BASIC at 0x4000 in slot 0, so a block below 0x8000 would be
 * written into RAM the CPU never selects and read back as ROM.
 */

/**
 * Headroom reserved beyond the raw tokenized program bytes for the variables,
 * arrays and strings that grow above it at run time and are not known until the
 * program runs. The same conservative margin the Spectrum and the CPCs use,
 * and comfortably clear of {@link hb10pMemoryBlocks.defaultAddress}.
 */
const PROGRAM_AREA_SLACK_BYTES = 768;

/** The RAM the CPU can reach on an unexpanded 64KB machine. */
const VALID_RANGES: readonly MemoryRange[] = [{ start: 0x8000, end: 0xffff }];

/**
 * Live machine state a block would clobber once the machine is running, which
 * is everything from the top of the program area up: the string space, the file
 * buffers, and the MSX system variable area the standard fixes above them. The
 * stack is in here too - the BIOS sets it up at the string space's floor and it
 * descends from there - which is why the reservation starts at 0xF0A0 rather
 * than at the HIMEM a clean boot reports. The boundaries are the ones the
 * memory map draws, read off the booted machine's own pointers.
 *
 * The screen is not here, and that is a fact about the machine rather than an
 * omission: the picture lives in the VDP's own 16KB, a second address space no
 * POKE reaches.
 */
const RESERVED_RANGES: readonly MemoryRange[] = [
  { start: 0xf0a0, end: 0xffff }, // strings, file buffers, system area, stack
];

/**
 * The BASIC program area for a program tokenized to `programByteSize` bytes:
 * the zero byte the line links terminate against at 0x8000, the program from
 * TXTTAB, and {@link PROGRAM_AREA_SLACK_BYTES} past it for the variables.
 */
function programArea(programByteSize: number): MemoryRange {
  const size = 1 + programByteSize + PROGRAM_AREA_SLACK_BYTES;
  return { start: TXTTAB - 1, end: TXTTAB - 1 + size - 1 };
}

export const hb10pMemoryBlocks: MemoryBlocksSupport = {
  cpu: 'z80',
  validRanges: VALID_RANGES,
  reservedRanges: RESERVED_RANGES,
  programArea,
  // Clear of any plausible program area and of the system area above it. The
  // on-machine equivalent is CLEAR 200,&HDFFF, which is what a program placing
  // a block here runs first so the interpreter stays below it.
  defaultAddress: 0xe000,
};
