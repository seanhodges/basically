import type { MemoryBlocksSupport, MemoryRange } from '../types';
import { PROG_START, RAM_BASE, RAM_END_16K } from './addresses';

/**
 * TRS-80 (Model I, 16K) {@link MemoryBlocksSupport} figures for the memory-block
 * linter (`src/app/blockLint.ts`). Addresses mirror the machine's documented
 * layout - see `emulator/memory.ts` for the byte-for-byte breakdown this
 * collapses into coarser bands.
 *
 * These are deliberately conservative 16K-model figures: RAM runs from 0x4000
 * up to 0x7FFF (16K above the ROM/IO/video page). A larger machine (32K to
 * 0xBFFF, 48K to 0xFFFF) has more room, but this dialect doesn't model those
 * here, so blocks are validated against the smallest configuration a program is
 * likely to run on rather than the most generous.
 */

/** BASIC program area start (TXTTAB) on a fresh machine. */
const PROG = PROG_START;

/**
 * Headroom reserved beyond the raw tokenized program bytes for the BASIC
 * variables area (and string/array workspace above it), which grows as the
 * program declares variables and isn't known until the program actually runs.
 * ~768 bytes is a conservative, documented margin - enough for a typical
 * program's variables without being so large it rejects blocks that would in
 * practice fit comfortably above them.
 */
const PROGRAM_AREA_SLACK_BYTES = 768;

/**
 * The 16K RAM span: everything above the ROM (0x0000-0x2FFF), the memory-mapped
 * I/O + keyboard page (0x3000-0x3BFF) and the 1K video RAM (0x3C00-0x3FFF).
 * The video page sits *below* this base, so it needs no reserved entry - it is
 * simply outside every valid range.
 */
const VALID_RANGES: readonly MemoryRange[] = [
  { start: RAM_BASE, end: RAM_END_16K },
];

/**
 * No reserved ranges: the only live machine state a block might clobber - the
 * video RAM at 0x3C00-0x3FFF - lies below the RAM base (0x4000) and is already
 * excluded by {@link VALID_RANGES}, so a block that touches it is a hard
 * "outside valid range" error rather than a soft warning.
 */
const RESERVED_RANGES: readonly MemoryRange[] = [];

/**
 * The BASIC program area for a program tokenized to `programByteSize` bytes:
 * starts at PROG and extends {@link PROGRAM_AREA_SLACK_BYTES} past the raw
 * program bytes to also cover the variables area.
 */
function programArea(programByteSize: number): MemoryRange {
  const size = programByteSize + PROGRAM_AREA_SLACK_BYTES;
  return { start: PROG, end: PROG + size - 1 };
}

export const trs80MemoryBlocks: MemoryBlocksSupport = {
  cpu: 'z80',
  validRanges: VALID_RANGES,
  reservedRanges: RESERVED_RANGES,
  programArea,
  defaultAddress: 0x7000,
};
