import type { MemoryBlocksSupport, MemoryRange } from '../types';
import { TEXT_START, RAM_END } from './addresses';

/**
 * Acorn Atom {@link MemoryBlocksSupport} figures for the memory-block linter
 * (`src/app/blockLint.ts`). Addresses come from `./addresses.ts`, the dialect's
 * single source for them; see `./memoryMap.ts` for the byte-for-byte breakdown
 * this collapses into coarser bands.
 *
 * A block may occupy RAM from {@link TEXT_START} up to {@link RAM_END}, the last
 * byte below the MC6847 VDG screen - placing one there won't corrupt the display.
 */

/**
 * Headroom reserved beyond the raw tokenized program bytes for the BASIC
 * variables area (and the workspace/stack that grow above it), which isn't
 * known until the program actually runs. 768 bytes is a conservative,
 * documented margin - enough for a typical program's variables without being
 * so large it rejects blocks that would in practice fit comfortably below the
 * `#8000` screen.
 */
const PROGRAM_AREA_SLACK_BYTES = 768;

/** User RAM above the OS/BASIC workspace and below the VDG screen. */
const VALID_RANGES: readonly MemoryRange[] = [
  { start: TEXT_START, end: RAM_END },
];

/**
 * The BASIC program area for a program tokenized to `programByteSize` bytes:
 * starts at {@link TEXT_START} and extends {@link PROGRAM_AREA_SLACK_BYTES}
 * past the raw program bytes to also cover the variables area.
 */
function programArea(programByteSize: number): MemoryRange {
  const size = programByteSize + PROGRAM_AREA_SLACK_BYTES;
  return { start: TEXT_START, end: TEXT_START + size - 1 };
}

export const atomMemoryBlocks: MemoryBlocksSupport = {
  cpu: '6502',
  validRanges: VALID_RANGES,
  // The Atom has no live hardware state inside the user-RAM window a block may
  // occupy (the screen sits above it at #8000), so nothing is merely reserved.
  reservedRanges: [],
  programArea,
  // Above a typical program (which starts at #2900), comfortably below the
  // #8000 screen - a sensible default the user can override.
  defaultAddress: 0x5000,
};
