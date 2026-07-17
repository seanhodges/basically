import type { MemoryBlocksSupport, MemoryRange } from '../types';

/**
 * ZX81 {@link MemoryBlocksSupport} figures for the memory-block linter
 * (`src/app/blockLint.ts`). Addresses mirror `./memoryMap.ts`'s documented 16K
 * layout and `./sysvars.ts`'s pointers.
 *
 * Placement caveats specific to the ZX81:
 *  - The display file and the variables area both grow *above* the BASIC
 *    program as it runs, so there is no fixed "top of used RAM" - high
 *    placement (near RAMTOP) is the safest bet but is still best-effort.
 *  - A block cannot ride in the .P snapshot: that image only spans SYSVARS
 *    (0x4009) up to E_LINE, i.e. the program and its live areas, so anything
 *    above used RAM or at a fixed address is invisible to it. The emulator
 *    therefore writes block bytes directly into RAM after the load (see
 *    `emulator/zx81Machine.ts` `loadProgram`), not through the image.
 */

/** First byte of the BASIC program area (PROGRAM_BASE = 0x407D). */
const PROGRAM_BASE = 0x407d;

/**
 * Headroom reserved beyond the raw tokenized program bytes for the display file
 * and variables area, which grow above the program once it runs and aren't
 * known until then. 768 bytes is a conservative, documented margin - roughly a
 * minimal collapsed display file plus a typical program's variables - without
 * being so large it rejects blocks that would in practice fit below RAMTOP
 * (0x8000 on a 16K machine).
 */
const PROGRAM_AREA_SLACK_BYTES = 768;

/** The full 16K RAM span; RAMTOP sits just above it at 0x8000. */
const VALID_RANGES: readonly MemoryRange[] = [{ start: 0x4000, end: 0x7fff }];

/**
 * The system-variable block below PROGRAM_BASE (0x4000-0x407C): live ROM state
 * a block placed here would clobber once the machine is running.
 */
const RESERVED_RANGES: readonly MemoryRange[] = [
  { start: 0x4000, end: 0x407c },
];

/**
 * The BASIC program area for a program tokenized to `programByteSize` bytes:
 * starts at PROGRAM_BASE and extends {@link PROGRAM_AREA_SLACK_BYTES} past the
 * raw program bytes to also cover the display file / variables area that grows
 * above the program.
 */
function programArea(programByteSize: number): MemoryRange {
  const size = programByteSize + PROGRAM_AREA_SLACK_BYTES;
  return { start: PROGRAM_BASE, end: PROGRAM_BASE + size - 1 };
}

export const zx81MemoryBlocks: MemoryBlocksSupport = {
  cpu: 'z80',
  validRanges: VALID_RANGES,
  reservedRanges: RESERVED_RANGES,
  programArea,
  defaultAddress: 0x7000,
};
