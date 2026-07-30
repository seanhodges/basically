import type { MemoryBlocksSupport, MemoryRange } from '../types';
import { PAGE } from './addresses';
import { SCREEN_FLOOR, RAM_TOP } from '../../emulator/bbc/addresses';

/**
 * BBC Master 128 {@link MemoryBlocksSupport} figures for the memory-block
 * linter (`src/app/blockLint.ts`). Addresses mirror `./memoryMap.ts`'s
 * documented at-boot layout (MOS 3.20 + BASIC IV, powering on to MODE 7) - see
 * that file for the byte-for-byte breakdown these coarser bands collapse.
 *
 * Identical to the Model B's figures except for where the BASIC program
 * starts: the Master's filing systems live in private RAM (ANDY/HAZEL) rather
 * than main memory, so PAGE stays at 0x0E00 (the Model B's DFS pushes it up to
 * 0x1900). The linter is static, so it uses this boot PAGE; the running machine
 * reads PAGE live from &18 at load time (see `bbcMachine.ts`'s `loadProgram`).
 */

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
 * moment the program selects a graphics mode. The screen floor varies with
 * MODE, which the static linter can't know, hence the conservative band.
 */
const RESERVED_RANGES: readonly MemoryRange[] = [
  { start: SCREEN_FLOOR, end: RAM_TOP },
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

export const bbcMasterMemoryBlocks: MemoryBlocksSupport = {
  cpu: '6502',
  validRanges: VALID_RANGES,
  reservedRanges: RESERVED_RANGES,
  programArea,
  // Above a small program, below the 0x3000 graphics-screen floor.
  defaultAddress: 0x2e00,
};
