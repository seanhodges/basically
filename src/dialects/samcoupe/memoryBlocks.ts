import type { MemoryBlocksSupport, MemoryRange } from '../types';

/**
 * Where a machine-code block may live in the SAM's Z80 window.
 *
 * The window is four 16K sections over 256K of RAM, and only two of them are
 * RAM at the BASIC prompt: section A holds ROM0 and section D ROM1 whenever the
 * ROM wants it. So a block is written into section B or section C - and those
 * two show the *same* page. The ROM leaves LMPR's page field at 0x1F, which
 * makes section B page 0, and HMPR at 0, which makes section C page 0 as well,
 * so 0x4000+n and 0x8000+n are one byte with two addresses. BASIC's own
 * pointers use the section C spelling (`PROG` reads 0x9CD5 on a fresh machine);
 * a block uses the section B one, and this is why:
 *
 * **Section B is the half that stays put.** A routine that wants to touch the
 * screen has to page it in, and the screen is paged in by writing HMPR - which
 * swaps section C, and section D with it, out from under whatever was there.
 * Section B is addressed off LMPR, which the routine must not touch: the ROM's
 * stack lives at 0x4Exx, in section B, so moving it takes the return address
 * with it. A routine at 0x7000 therefore survives its own paging, and the
 * kaleidoscope sample is built on exactly that.
 *
 * Addresses here are the section B spelling throughout, so the linter compares
 * like with like; `./memoryMap.ts` describes the same bytes under both.
 */

/** Section B: 0x4000-0x7FFF, RAM page (LMPR + 1) & 0x1F - page 0 at the prompt. */
const SECTION_B: MemoryRange = { start: 0x4000, end: 0x7fff };

/**
 * `PROG` on a freshly booted machine, in the section B spelling: the ROM
 * reports page 0 offset 0x1CD5, which section C shows at 0x9CD5.
 */
const PROG = 0x5cd5;

/**
 * Headroom reserved beyond the raw tokenized program for the variable areas
 * above it, which grow as the program runs and are not known until it does. The
 * ROM's own three areas measure 0x25D bytes on a machine with no program at
 * all; 1K is a conservative round figure above that, and still leaves the
 * default block address more than 4K clear of the program.
 */
const PROGRAM_AREA_SLACK_BYTES = 1024;

/**
 * Live machine state a block would clobber: everything below `PROG` in page 0 -
 * the ROM's buffers and its stack, then the system variables the interpreter
 * reads on every statement.
 */
const RESERVED_RANGES: readonly MemoryRange[] = [
  { start: 0x4000, end: 0x59ff }, // ROM workspace, buffers and the stack
  { start: 0x5a00, end: PROG - 1 }, // system variables, then channel information
];

/** The BASIC program and the variable areas that grow above it. */
function programArea(programByteSize: number): MemoryRange {
  const size = programByteSize + PROGRAM_AREA_SLACK_BYTES;
  return { start: PROG, end: PROG + size - 1 };
}

export const samcoupeMemoryBlocks: MemoryBlocksSupport = {
  cpu: 'z80',
  validRanges: [SECTION_B],
  reservedRanges: RESERVED_RANGES,
  programArea,
  defaultAddress: 0x7000,
};
