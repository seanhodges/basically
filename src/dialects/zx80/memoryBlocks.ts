import type { MemoryBlocksSupport, MemoryRange } from '../types';
import { zx80ListingLayout } from './listingLayout';

/**
 * ZX80 {@link MemoryBlocksSupport} figures for the memory-block linter
 * (`src/app/blockLint.ts`). Addresses mirror `./memoryMap.ts`'s documented 16K
 * layout and `./sysvars.ts`'s pointers.
 *
 * Placement caveats specific to the ZX80:
 *  - The ZX80 stacks its dynamic areas as sysvars -> program -> variables ->
 *    edit line -> display file, all of which grow *above* the program as it
 *    runs, so there is no fixed "top of used RAM" - high placement (near the
 *    top of the RAM pack) is the safest bet but is still best-effort.
 *  - A block cannot ride in the .O snapshot: that image is a straight RAM dump
 *    from SYSVARS (0x4000) up to the end of the display file, so anything above
 *    used RAM or at a fixed address is invisible to it. The emulator therefore
 *    writes block bytes directly into RAM after the load and before RUN (see
 *    `emulator/zx80Machine.ts` `loadProgram`), not through the image.
 */

/** First byte of the BASIC program area (PROGRAM_BASE = 0x4028). */
const PROGRAM_BASE = 0x4028;

/**
 * Headroom reserved beyond the raw tokenized program bytes for the variables,
 * edit line, and display file, which grow above the program once it runs and
 * aren't known until then. 768 bytes is a conservative, documented margin
 * without being so large it rejects blocks that would in practice fit below the
 * top of RAM.
 */
const PROGRAM_AREA_SLACK_BYTES = 768;

/** The full 16K RAM span; the echo region mirrors it from 0x8000 up. */
const VALID_RANGES: readonly MemoryRange[] = [{ start: 0x4000, end: 0x7fff }];

/**
 * The 40-byte system-variable block below PROGRAM_BASE (0x4000-0x4027): live
 * ROM state a block placed here would clobber once the machine is running.
 */
const RESERVED_RANGES: readonly MemoryRange[] = [
  { start: 0x4000, end: 0x4027 },
];

/**
 * The BASIC program area for a program tokenized to `programByteSize` bytes:
 * starts at PROGRAM_BASE and extends {@link PROGRAM_AREA_SLACK_BYTES} past the
 * raw program bytes to also cover the variables / edit line / display file that
 * grows above the program.
 */
function programArea(programByteSize: number): MemoryRange {
  const size = programByteSize + PROGRAM_AREA_SLACK_BYTES;
  return { start: PROGRAM_BASE, end: PROGRAM_BASE + size - 1 };
}

export const zx80MemoryBlocks: MemoryBlocksSupport = {
  cpu: 'z80',
  validRanges: VALID_RANGES,
  reservedRanges: RESERVED_RANGES,
  programArea,
  defaultAddress: 0x7000,
  // ZX80 blocks are hidden-machine-code REM records inside the BASIC listing,
  // carried in the monolithic .O image - not fixed-address RAM injections. The
  // fixed-address figures above are inert; kept only so the type stays total.
  inListing: true,
  listing: zx80ListingLayout,
};
