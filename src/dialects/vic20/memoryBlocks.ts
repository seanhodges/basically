import type { MemoryBlocksSupport, MemoryRange } from '../types';
import { PROGRAM_BASE } from './addresses';

/**
 * Commodore VIC-20 {@link MemoryBlocksSupport} figures for the memory-block
 * linter (`src/app/blockLint.ts`). Addresses mirror the VIC-20's documented
 * boot-time memory map (see `./memoryMap.ts`) for the unexpanded machine.
 *
 * The emulator models the unexpanded VIC-20. RAM expansions (3K at $0400 and
 * the 8K/16K/24K blocks that move BASIC's start address) are well documented
 * but not modelled, so these are the conservative unexpanded-machine figures.
 */

/** BASIC program start on the unexpanded VIC-20: TXTTAB = $1001 = 4097. */
const PROG = PROGRAM_BASE;

/**
 * Headroom reserved beyond the raw tokenized program bytes for BASIC's
 * variable / array / string areas, which grow up from just past the program.
 * The unexpanded VIC-20 has only ~3.5K free, so the margin is smaller than the
 * larger Commodore machines': ~512 bytes.
 */
const PROGRAM_AREA_SLACK_BYTES = 512;

/**
 * The usable BASIC RAM span on the unexpanded machine: from $1000 up to $1DFF,
 * the last byte below the $1E00 screen. (The $0400-$0FFF 3K expansion window is
 * absent on the unexpanded machine, so it is not part of the valid range.)
 */
const VALID_RANGES: readonly MemoryRange[] = [{ start: 0x1000, end: 0x1dff }];

/**
 * The default screen matrix at $1E00-$1FFF - live machine state a block placed
 * there would clobber once the machine is running, so it is flagged as a
 * warning rather than rejected.
 */
const RESERVED_RANGES: readonly MemoryRange[] = [
  { start: 0x1e00, end: 0x1fff },
];

/**
 * The BASIC program area for a program tokenized to `programByteSize` bytes:
 * starts at PROG and extends {@link PROGRAM_AREA_SLACK_BYTES} past the raw
 * program bytes to also cover the variables area.
 */
function programArea(programByteSize: number): MemoryRange {
  const size = programByteSize + PROGRAM_AREA_SLACK_BYTES;
  return { start: PROG, end: PROG + size - 1 };
}

export const vic20MemoryBlocks: MemoryBlocksSupport = {
  cpu: '6502',
  validRanges: VALID_RANGES,
  reservedRanges: RESERVED_RANGES,
  programArea,
  // Near the top of the unexpanded user BASIC RAM, below the screen at $1E00.
  defaultAddress: 0x1c00,
};
