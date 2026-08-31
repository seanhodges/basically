// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryBlocksSupport, MemoryRange } from '../types';
import { DEFAULT_MEMSIZ, PROGRAM_BASE } from './addresses';

/**
 * Machine-code blocks. There is one page of RAM for them and it is page 3.
 *
 * The 48K below the I/O page is spoken for from both ends, and by the same
 * claimants as on the sibling: zero page is the interpreter's and the monitor's,
 * `$0100`-`$01FF` is the stack, `$0200`-`$02FF` is the buffer a typed line
 * arrives in, and `$0400`-`$07FF` is text page 1. Above that the cold start's
 * `MEMSIZ` claims `$0801`-`$BFFF` outright - the program grows up from `$0801`
 * with its variables and arrays behind it and the string space growing down
 * from the top - so there is no free RAM above the program either. `$0300`-
 * `$03FF` is what is left.
 */
const VALID_RANGES: readonly MemoryRange[] = [{ start: 0x0300, end: 0x03ff }];

/**
 * The vector block at the top of the page - sixteen bytes here where the
 * sibling reserves eight, because the Autostart Monitor keeps state there that
 * the original monitor does not:
 *
 *     $03F0-$03F1  BRK vector, into the monitor at $FA59
 *     $03F2-$03F3  SOFTEV, the RESET re-entry - $E003, Applesoft's warm start
 *     $03F4        PWREDUP, SOFTEV's high byte EOR $A5
 *     $03F5-$03F7  Applesoft's `&` vector
 *     $03F8-$03FA  the monitor's CTRL-Y command
 *     $03FB-$03FD  NMI ($FFFA points here)
 *     $03FE-$03FF  IRQ, reached by `JMP ($03FE)` on a non-BRK interrupt
 *
 * Only the first five bytes are written by the firmware - a boot leaves the
 * rest of the page exactly as it found it - but the first five are the ones
 * that bite. The Autostart Monitor checks PWREDUP against SOFTEV on every
 * RESET and cold-starts when they disagree, so a block sitting across `$03F2`
 * turns the RESET key from "come back to the listing" into "lose it". A warning
 * rather than an error because a program that never presses RESET, never uses
 * `&` and raises no interrupt never notices, and RESET rewrites those five
 * bytes rather than reading the block's.
 */
const RESERVED_RANGES: readonly MemoryRange[] = [
  { start: 0x03f0, end: 0x03ff },
];

/**
 * The whole workspace, whatever the program's size.
 *
 * The program grows up from `$0801` and the string space grows down from
 * `MEMSIZ`, with the variables and arrays in between, so both ends of the
 * region are occupied and the free space is in the middle. A range from the
 * base to "program plus slack" would name the half most likely to be empty,
 * which is why the answer ignores the size and why the block window has to sit
 * below `$0801`.
 *
 * Unlike the sibling's this reads nothing out of the source: Applesoft's
 * program is always at `$0801` and only a `HIMEM:` executed at run time moves
 * the other end, which no lint pass can know about.
 */
function programArea(): MemoryRange {
  return { start: PROGRAM_BASE, end: DEFAULT_MEMSIZ - 1 };
}

export const apple2plusMemoryBlocks: MemoryBlocksSupport = {
  cpu: '6502',
  validRanges: VALID_RANGES,
  reservedRanges: RESERVED_RANGES,
  programArea,
  defaultAddress: 0x0300,
};
