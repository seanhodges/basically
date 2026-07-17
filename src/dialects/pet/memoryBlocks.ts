import type { MemoryBlocksSupport, MemoryRange } from '../types';

/**
 * Commodore PET {@link MemoryBlocksSupport} figures for the memory-block linter
 * (`src/app/blockLint.ts`). Addresses mirror the PET's documented boot-time
 * memory map (see `./memoryMap.ts`) for the modelled 32K base machine.
 *
 * The emulator models a fixed 32 KB PET; RAM/ROM expansions and higher-memory
 * variants (e.g. the 8000-series 80-column machines) are not modelled, so these
 * are deliberately conservative base-RAM figures rather than a maximal map.
 */

/** BASIC program start on a 32K PET: TXTTAB = $0401 = 1025. */
const PROG = 0x0401;

/**
 * Headroom reserved beyond the raw tokenized program bytes for BASIC's
 * variable / array / string areas, which grow up from just past the program
 * and aren't known until it runs. ~1KB is a conservative, documented margin.
 */
const PROGRAM_AREA_SLACK_BYTES = 1024;

/**
 * The usable RAM span: from $0400 (the first byte above the zero page, stack,
 * and $0000-$03FF system page) up to the top of the modelled 32K RAM at $7FFF.
 * The screen, I/O and ROMs live at $8000 and above, outside this window.
 */
const VALID_RANGES: readonly MemoryRange[] = [{ start: 0x0400, end: 0x7fff }];

/** No sub-ranges of the base RAM are flagged as reserved on the PET. */
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

export const petMemoryBlocks: MemoryBlocksSupport = {
  cpu: '6502',
  validRanges: VALID_RANGES,
  reservedRanges: RESERVED_RANGES,
  programArea,
  // High in the modelled 32K RAM, well clear of the program/variable area.
  defaultAddress: 0x7000,
};
