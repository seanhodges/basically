import type { MemoryBlocksSupport, MemoryRange } from '../types';
import { PROG_BASE } from './sysvars';

/**
 * ZX Spectrum 48K {@link MemoryBlocksSupport} figures for the memory-block
 * linter (`src/app/blockLint.ts`). Addresses mirror `./memoryMap.ts`'s
 * documented, at-boot 48K layout - see that file for the byte-for-byte
 * breakdown this collapses into coarser bands.
 */

/** BASIC program area start on a fresh 48K machine (23755). */
const PROG = PROG_BASE;

/**
 * Headroom reserved beyond the raw tokenized program bytes for the BASIC
 * variables area (and the editing workspace immediately above it), which
 * grows as the program declares variables and isn't known until the program
 * actually runs. ~768 bytes is a conservative, documented margin - enough for
 * a typical program's variables without being so large it rejects blocks that
 * would in practice fit comfortably above a real RAMTOP (0xFF57 by default).
 */
const PROGRAM_AREA_SLACK_BYTES = 768;

/** The full 48K RAM span: everything above the 16K ROM. */
const VALID_RANGES: readonly MemoryRange[] = [{ start: 0x4000, end: 0xffff }];

/**
 * Live machine state a block would clobber once the machine is running:
 * screen bitmap + colour attributes (combined - see `./memoryMap.ts`'s
 * "Screen memory" group), the ZX Printer line buffer, and the ROM's system
 * variables + channel information (combined - "System area" there).
 */
const RESERVED_RANGES: readonly MemoryRange[] = [
  { start: 0x4000, end: 0x5aff }, // display file + colour attributes
  { start: 0x5b00, end: 0x5bff }, // printer buffer
  { start: 0x5c00, end: 0x5cca }, // system variables + channel information
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

export const spectrumMemoryBlocks: MemoryBlocksSupport = {
  cpu: 'z80',
  validRanges: VALID_RANGES,
  reservedRanges: RESERVED_RANGES,
  programArea,
  defaultAddress: 0x8000,
};
