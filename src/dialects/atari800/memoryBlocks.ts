// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryBlocksSupport, MemoryRange } from '../types';
import {
  ATARI_400_RAM_TOP,
  ATARI_800_RAM_TOP,
  BASIC_WORKSPACE_BASE,
  GRAPHICS_0_DISPLAY_BYTES,
} from './addresses';

/**
 * Where a memory block may sit on an Atari 400 or 800, for the block linter
 * (`src/app/blockLint.ts`).
 *
 * The two machines share one shape and differ only in where RAM ends, so the
 * figures are built from that one number. Below `$0400` there is nothing to
 * place a block in - the zero page, the stack and the OS's own variables fill
 * it - so the valid span starts at the cassette buffer and runs to the top of
 * fitted RAM.
 *
 * `$0600`-`$06FF` is the one page of this map that is free by convention: the
 * OS's buffers end below it and BASIC's workspace begins above it, and neither
 * ever writes there. It is where an Atari machine-code routine has always
 * gone, and it is the default a new block is offered.
 */

/** The 256 bytes between the OS's buffers and BASIC's workspace. */
const FREE_PAGE = 0x0600;

/**
 * The OS's buffers, `$0400`-`$05FF`: the cassette record, the spare bytes a
 * disk operating system would take, and the line buffer the screen editor
 * assembles every `PRINT` in. A block may live here - a program that leaves the
 * devices alone never disturbs it - but the OS writes over it the moment one is
 * used, so it is flagged rather than accepted quietly.
 */
const DEVICE_BUFFERS: MemoryRange = { start: 0x0400, end: 0x05ff };

/**
 * Bytes of RAM the screen and its display list take off the top. GRAPHICS 0
 * is the smallest of them, so this is the least a mode will claim and a block
 * above it is certain to be overwritten.
 */
const SCREEN_BYTES = GRAPHICS_0_DISPLAY_BYTES;

/**
 * Headroom past the tokenized program for the variable, array and string
 * space BASIC grows above it, which is not known until the program runs. A
 * kilobyte is the same conservative margin the other machines here reserve.
 */
const PROGRAM_AREA_SLACK_BYTES = 1024;

/** The block-linter figures for a machine whose RAM ends at `top`. */
export function atariMemoryBlocks(top: number): MemoryBlocksSupport {
  return {
    cpu: '6502',
    validRanges: [{ start: DEVICE_BUFFERS.start, end: top - 1 }],
    reservedRanges: [
      DEVICE_BUFFERS,
      { start: top - SCREEN_BYTES, end: top - 1 },
    ],
    programArea(programByteSize: number): MemoryRange {
      return {
        start: BASIC_WORKSPACE_BASE,
        end:
          BASIC_WORKSPACE_BASE + programByteSize + PROGRAM_AREA_SLACK_BYTES - 1,
      };
    },
    defaultAddress: FREE_PAGE,
  };
}

/** Atari 800: 48K fitted, but the BASIC cartridge covers everything from `$A000`. */
export const atari800MemoryBlocks = atariMemoryBlocks(ATARI_800_RAM_TOP);

/** Atari 400: the same map with RAM ending at 16K. */
export const atari400MemoryBlocks = atariMemoryBlocks(ATARI_400_RAM_TOP);
