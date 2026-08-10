import type {
  ConditionalFreeRange,
  MemoryBlocksSupport,
  MemoryRange,
} from '../types';
import { PAGE_DFS } from './addresses';
import {
  SCREEN_FLOOR,
  SCREEN_MODE7_BASE,
  RAM_TOP,
} from '../../emulator/bbc/addresses';

/**
 * BBC Micro Model B {@link MemoryBlocksSupport} figures for the memory-block
 * linter (`src/app/blockLint.ts`). Addresses mirror `./memoryMap.ts`'s
 * documented at-boot layout (OS 1.20 + BASIC II + DFS, powering on to MODE 7) -
 * see that file for the byte-for-byte breakdown these coarser bands collapse.
 *
 * The linter is static, so it uses the machine's *boot* PAGE. On a Model B the
 * DFS claims 0x0E00-0x18FF, pushing PAGE (the BASIC program start) up to
 * 0x1900. The running machine reads PAGE live from &18 at load time (see
 * `bbcMachine.ts`'s `loadProgram`); this linter can't, so it assumes that boot
 * value - the same value the memory map is drawn against.
 */

/** BASIC program area start on a fresh DFS-equipped Model B. */
const PAGE = PAGE_DFS;

/**
 * Headroom reserved beyond the raw tokenized program bytes for BASIC's
 * variables and workspace, which grow as the program declares variables and
 * aren't known until it runs. 512 bytes is a conservative, documented margin -
 * enough for a small program's variables without so large a footprint that it
 * rejects blocks that would in practice fit comfortably below the screen.
 */
const PROGRAM_AREA_SLACK_BYTES = 512;

/** User RAM from PAGE up to the top of main RAM (below the 0x8000 ROM slot). */
const VALID_RANGES: readonly MemoryRange[] = [{ start: PAGE, end: RAM_TOP }];

/**
 * Live machine state a block would clobber once the machine is running:
 * screen RAM. In graphics modes the screen reaches down as far as 0x3000
 * (MODE 0-2), so the whole 0x3000-0x7FFF band is flagged as a warning - a
 * block there is fine in MODE 7 (only 0x7C00+ is screen) but overwritten the
 * moment the program selects a graphics mode.
 */
const RESERVED_RANGES: readonly MemoryRange[] = [
  { start: SCREEN_FLOOR, end: RAM_TOP },
];

/**
 * The band the bitmap screens reach down into, which a MODE 7 program leaves
 * alone. Twenty kilobytes: the whole distance between the graphics screens'
 * floor and the teletext screen the machine powers on displaying.
 *
 * This is the part of {@link RESERVED_RANGES} the blanket warning above covers
 * conservatively because the screen floor moves with MODE. Where the program's
 * own text fixes every MODE it selects at 7, the floor does not move and the
 * band is ordinary RAM.
 */
const CONDITIONALLY_FREE: readonly ConditionalFreeRange[] = [
  {
    range: { start: SCREEN_FLOOR, end: SCREEN_MODE7_BASE - 1 },
    condition: { kind: 'screen-modes', modes: [7] },
    conditionText: 'the program stays in the teletext mode (MODE 7)',
    note: 'the frame buffer MODE 0-MODE 6 draw into',
  },
];

/**
 * The BASIC program area for a program tokenized to `programByteSize` bytes:
 * starts at PAGE and extends {@link PROGRAM_AREA_SLACK_BYTES} past the raw
 * program bytes to also cover the variables/workspace area.
 */
function programArea(programByteSize: number): MemoryRange {
  const size = programByteSize + PROGRAM_AREA_SLACK_BYTES;
  return { start: PAGE, end: PAGE + size - 1 };
}

export const bbcMicroMemoryBlocks: MemoryBlocksSupport = {
  cpu: '6502',
  validRanges: VALID_RANGES,
  reservedRanges: RESERVED_RANGES,
  conditionallyFree: CONDITIONALLY_FREE,
  screenModeCommand: { keyword: 'MODE', bootMode: 7 },
  programArea,
  // Above a small program, below the 0x3000 graphics-screen floor.
  defaultAddress: 0x2e00,
};
