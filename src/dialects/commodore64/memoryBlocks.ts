import type { MemoryBlocksSupport, MemoryRange } from '../types';

/**
 * Commodore 64 {@link MemoryBlocksSupport} figures for the memory-block linter
 * (`src/app/blockLint.ts`). Addresses mirror the C64's documented boot-time
 * memory map (see `./memoryMap.ts`): the 6502 sees a flat 64K address space,
 * most of it RAM at reset, with ROM/IO banked in over the top by the $01 port.
 */

/** BASIC program start on a fresh C64: TXTTAB = $0801 = 2049. */
const PROG = 0x0801;

/**
 * Headroom reserved beyond the raw tokenized program bytes for BASIC's
 * variable / array / string areas, which grow up from just past the program
 * and aren't known until it runs. ~1KB is a conservative, documented margin -
 * enough for a typical program's variables without being so large it rejects
 * blocks that would in practice fit comfortably in the RAM above them.
 */
const PROGRAM_AREA_SLACK_BYTES = 1024;

/**
 * The usable RAM span: everything from $0800 (the first byte above the
 * zero page, stack, and the default $0400 screen / system area) up to the top
 * of the address space. $A000-$BFFF and $E000-$FFFF hold ROM at reset but are
 * RAM underneath (a machine-code block can bank them in), so they stay valid.
 */
const VALID_RANGES: readonly MemoryRange[] = [{ start: 0x0800, end: 0xffff }];

/**
 * The I/O area ($D000-$DFFF: VIC-II, SID, colour RAM, CIAs) as seen when it is
 * banked in - the default state at the READY prompt. A block placed here lands
 * on RAM only while I/O is banked out, so it is flagged as a warning, not
 * rejected: a machine-code block may legitimately use the RAM under I/O.
 */
const RESERVED_RANGES: readonly MemoryRange[] = [
  { start: 0xd000, end: 0xdfff },
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

export const c64MemoryBlocks: MemoryBlocksSupport = {
  cpu: '6502',
  validRanges: VALID_RANGES,
  reservedRanges: RESERVED_RANGES,
  programArea,
  // $C000-$CFFF is always RAM (no ROM or I/O banks over it), so a block placed
  // here is safe from banking and out of BASIC's way - the natural default.
  defaultAddress: 0xc000,
};
