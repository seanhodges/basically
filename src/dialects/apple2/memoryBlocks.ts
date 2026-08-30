// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryBlocksSupport, MemoryRange } from '../types';
import { DEFAULT_HIMEM, DEFAULT_LOMEM } from './addresses';
import { declaredWorkspace } from './directLine';

/**
 * Machine-code blocks. There is one page of RAM for them and it is page 3.
 *
 * The 48K below the I/O page is spoken for from both ends. Zero page is the
 * interpreter's and the monitor's, `$0100`-`$01FF` is the stack, `$0200`-`$02FF`
 * is the buffer the monitor assembles a typed line in and Integer BASIC crunches
 * it in, and `$0400`-`$07FF` is text page 1. Above that, the cold start's
 * `LOMEM`/`HIMEM` pair claims `$0800`-`$BFFF` outright: the workspace runs to the
 * top of RAM, so unlike every machine that grows its program up from a base
 * there is no free RAM above the program either. `$0300`-`$03FF` is what is
 * left, and a boot followed by a run leaves all 256 bytes untouched.
 *
 * The window is the free RAM below the *stock* LOMEM. A program that lowers
 * LOMEM claims part of it for the workspace, which is why {@link programArea}
 * reads the program's own bounds rather than assuming the stock ones.
 */
const VALID_RANGES: readonly MemoryRange[] = [{ start: 0x0300, end: 0x03ff }];

/**
 * The monitor's vector block at the top of the page. Nothing writes it, so a
 * block may sit there and run; what it costs is the three jumps the firmware
 * takes through it - `JMP $03F8` for the monitor's CTRL-Y command, the NMI
 * vector at `$03FB` (`$FFFA` points there) and `JMP ($03FE)` for a non-BRK
 * interrupt. A block overlapping them is a warning rather than an error because
 * a program that raises none of the three never notices.
 */
const RESERVED_RANGES: readonly MemoryRange[] = [
  { start: 0x03f8, end: 0x03ff },
];

/**
 * The whole workspace, whatever the program's size.
 *
 * As on the Apple I, the program grows DOWN from HIMEM and the variables UP
 * from LOMEM, so both ends of the region are occupied and the free space is in
 * the middle. A range from a base to "program plus slack" would name the half
 * guaranteed to be empty, which is why the answer ignores the size and why the
 * block window has to sit below LOMEM.
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

export const apple2MemoryBlocks: MemoryBlocksSupport = {
  cpu: '6502',
  validRanges: VALID_RANGES,
  reservedRanges: RESERVED_RANGES,
  programArea,
  defaultAddress: 0x0300,
};
