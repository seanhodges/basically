import type { MemoryBlocksSupport, MemoryRange } from '../types';

/**
 * Amstrad CPC 464 {@link MemoryBlocksSupport} for the memory-block linter
 * (`src/app/blockLint.ts`). The CPC is a flat 64K of RAM (the ROMs are read
 * overlays only), so a block may sit almost anywhere - the ranges below mirror
 * `./memoryMap.ts`. Machine-side injection is handled by `loadProgram` in
 * `src/emulator/cpc/cpcMachine.ts`.
 */

/** BASIC program area start on the 464 (tokenized lines from &0170 up). */
const PROGRAM_BASE = 0x0170;

/**
 * Headroom reserved beyond the raw tokenized program bytes for the variables
 * and arrays that grow above it at run time (not known until the program runs).
 * A conservative margin matching the Spectrum's, comfortably clear of the
 * default block address (&8000) and HIMEM (&AB7F).
 */
const PROGRAM_AREA_SLACK_BYTES = 768;

/** All RAM above the Z80 restart page, which the firmware needs intact. */
const VALID_RANGES: readonly MemoryRange[] = [{ start: 0x0040, end: 0xffff }];

/**
 * Live machine state a block would clobber once the machine is running: the
 * firmware/BASIC workspace below the program, the high BASIC workspace and
 * firmware jumpblocks above HIMEM, and the screen bitmap (see `./memoryMap.ts`).
 */
const RESERVED_RANGES: readonly MemoryRange[] = [
  { start: 0x0040, end: 0x016f }, // firmware & BASIC workspace
  { start: 0xab80, end: 0xbfff }, // high BASIC workspace + firmware jumpblocks
  { start: 0xc000, end: 0xffff }, // screen memory
];

/**
 * The BASIC program area for a program tokenized to `programByteSize` bytes:
 * starts at &0170 and extends {@link PROGRAM_AREA_SLACK_BYTES} past the raw
 * program bytes to also cover the variables/arrays area.
 */
function programArea(programByteSize: number): MemoryRange {
  const size = programByteSize + PROGRAM_AREA_SLACK_BYTES;
  return { start: PROGRAM_BASE, end: PROGRAM_BASE + size - 1 };
}

export const cpc464MemoryBlocks: MemoryBlocksSupport = {
  cpu: 'z80',
  validRanges: VALID_RANGES,
  reservedRanges: RESERVED_RANGES,
  programArea,
  // Below default HIMEM (&AB7F); the on-machine equivalent is MEMORY &7FFF.
  defaultAddress: 0x8000,
};
