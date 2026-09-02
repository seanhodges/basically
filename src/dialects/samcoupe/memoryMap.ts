import type { MemoryMap } from '../types';

/**
 * The SAM Coupé's memory map, as `PEEK`, `POKE`, `CALL` and `USR` address it.
 *
 * The machine has 256K behind a 64K window, so "which 64K" is a real question
 * here in a way it is not on the rest of the registry. The answer is not the
 * Z80's window - that changes under the program's feet, and section C alone
 * shows five different pages during an ordinary `LIST`. It is the address space
 * SAM BASIC's own memory statements use, which the ROM fixes relative to
 * BASIC's base page (`PDPSUBR` in the ROM's misc1.asm, and the note above it):
 *
 *   0x0000-0x3FFF  ROM 0
 *   0x4000-0x7FFF  the base page - page 0, BASIC's own
 *   0x8000-0xBFFF  base + 1
 *   0xC000-0xFFFF  base + 2
 *
 * and on past 0xFFFF to 0x1FFFF for the pages above that, which is where the
 * BASIC area's fourth and last page sits. Only the first 64K is drawn, because
 * every map in the registry spans the same space and the porting guide draws
 * two of them against one scale; the region notes carry the rest.
 *
 * This is also the spelling `./memoryBlocks.ts` validates against, and the two
 * agree byte for byte: a block at 0x7000 is page 0 offset 0x3000, which is what
 * the CPU sees at 0x7000 while the ROM's own paging is in force. The live
 * overlay is translated into this space rather than drawn from the CPU's
 * addresses - see `stamp` in `./emulator/memory.ts`.
 *
 * Sources:
 *  - The ROM's own assembly source (`simonowen/samrom`): vars.asm for every
 *    boundary below `PROG`, misc1.asm for the address space above.
 *  - `./sysvars.ts` and `./memoryBlocks.ts` for the pointers read back off the
 *    booted machine; `./memoryMap.test.ts` pins the map against it.
 */

/** `HPEND`/`BSTACK` in vars.asm: the string heap and the BASIC stack share 0x4000-0x4AFF. */
const HEAP_BASE = 0x4000;
/** `HDR` in vars.asm: the 80-byte tape header buffers. */
const TAPE_HEADERS = 0x4b00;
/** `INTSTK` in vars.asm; `ISPVAL` puts the Z80's own stack top at 0x4F00. */
const INTERPRETER_STACKS = 0x4c00;
/** `INSTBUF` in vars.asm: the ROM1 transfer buffer and the buffers after it. */
const TRANSFER_BUFFERS = 0x4f00;
/**
 * `CHARSVAL` in vars.asm: the font the boot unpacks into RAM. `CHARS` points
 * 256 bytes below it, so glyph `c` is at CHARS + 8c and code 32 lands here.
 */
const CHARSET = 0x5190;
/** The 25 UDGs, codes 0x90-0xA8, where a booted machine's `UDG` sysvar points. */
const UDG = 0x5510;
/** `PALTAB` in vars.asm: the palette table, the line-interrupt colours and the key tables. */
const PALETTE_TABLES = 0x55d8;
/** `VAR2` in vars.asm: the system variables, which must start on a page boundary. */
const SYSVARS = 0x5a00;
/** `CHANS` on a booted machine: the channel and stream data below the program. */
const CHANNELS = 0x5cb6;
/** `PROG` on a booted machine - the same base `./memoryBlocks.ts` reserves up to. */
const PROG = 0x5cd5;

export const samcoupeMemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  // No `udgBase`: the UDGs are at 0x5510, but SAM BASIC's `USR` takes a number
  // only (`R0USR` in eval.asm), so there is no `POKE USR "a"` form to resolve.
  regions: [
    {
      start: 0x0000,
      end: 0x3fff,
      label: 'ROM 0',
      kind: 'rom',
      note: 'The first half of the 32K ROM. Read-only - POKEs here have no effect. ROM 1 is the other half, which the ROM pages into 0xC000-0xFFFF of the CPU window when it needs it.',
    },
    {
      start: HEAP_BASE,
      end: TAPE_HEADERS - 1,
      label: 'Heap and BASIC stack',
      kind: 'system',
      group: 'Interpreter workspace',
      note: 'The string heap grows up from 0x4000; the DO/LOOP/PROC stack grows down from 0x4AFF. "BASIC stack full" is these two meeting.',
    },
    {
      start: TAPE_HEADERS,
      end: INTERPRETER_STACKS - 1,
      label: 'Tape header buffers',
      kind: 'buffer',
      group: 'Interpreter workspace',
      note: 'The 80-byte header a SAVE writes, and the one a LOAD reads back.',
    },
    {
      start: INTERPRETER_STACKS,
      end: TRANSFER_BUFFERS - 1,
      label: 'Interpreter stacks',
      kind: 'system',
      group: 'Interpreter workspace',
      note: "The interrupt stack, the calculator stack from 0x4D00 up, and the Z80's own stack growing down from 0x4F00.",
    },
    {
      start: TRANSFER_BUFFERS,
      end: CHARSET - 1,
      label: 'Transfer and name buffers',
      kind: 'buffer',
      group: 'Interpreter workspace',
      note: 'The code the ROM copies here to cross between its two halves, the message and file buffers, the 32-entry page allocation table, and the buffer a variable name is matched in.',
    },
    {
      start: CHARSET,
      end: UDG - 1,
      label: 'Character set',
      kind: 'system',
      group: 'Interpreter workspace',
      note: 'The font unpacked out of the ROM at boot, codes 32-143 at eight bytes each. Move CHARS and the machine prints from somewhere else.',
    },
    {
      start: UDG,
      end: PALETTE_TABLES - 1,
      label: 'User-defined graphics',
      kind: 'system',
      group: 'Interpreter workspace',
      note: 'The 25 redefinable characters, codes 144-168, in the same eight-bytes-per-glyph form as the font below them.',
    },
    {
      start: PALETTE_TABLES,
      end: SYSVARS - 1,
      label: 'Palette and key tables',
      kind: 'system',
      group: 'Interpreter workspace',
      note: 'The 16-entry CLUT shadow, the line-interrupt colour table, the DEF KEYCODE definitions and the keyboard table.',
    },
    {
      start: SYSVARS,
      end: CHANNELS - 1,
      label: 'System variables',
      kind: 'system',
      group: 'Interpreter workspace',
      note: "The interpreter's working variables: the pointers that bound the BASIC area, the print and window state, the error and interrupt vectors.",
    },
    {
      start: CHANNELS,
      end: PROG - 1,
      label: 'Channel information',
      kind: 'system',
      group: 'Interpreter workspace',
      note: 'Channel and stream data, set up just below the BASIC program area.',
    },
    {
      start: PROG,
      end: 0x7fff,
      label: 'BASIC program',
      kind: 'program',
      group: 'BASIC area',
      note: 'The program and the variable areas above it, from PROG upward. Machine-code blocks go here too, above where the program can reach.',
    },
    {
      start: 0x8000,
      end: 0xbfff,
      label: 'BASIC area, second page',
      kind: 'program',
      group: 'BASIC area',
      note: "The 16K page above BASIC's own. A program long enough to fill page 0 continues here, and PEEK reaches it at these addresses whatever the CPU has paged in.",
    },
    {
      start: 0xc000,
      end: 0xffff,
      label: 'BASIC area, third page',
      kind: 'program',
      group: 'BASIC area',
      note: "The third of BASIC's four pages. The fourth runs on past this map, at 0x10000-0x13FFF, and RAMTOP sits at its top - 64K of program, variables and strings in all.",
    },
  ],
};
