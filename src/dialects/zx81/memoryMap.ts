import type { MemoryMap } from '../types';
import { SYSVARS_BASE, PRBUFF, MEMBOT, PROGRAM_BASE } from './sysvars';

/**
 * ZX81 memory map for the memory-map viewer, as the base 16K machine sees it
 * (the IDE always builds the ZX81 with a 16K RAM pack).
 *
 * The ZX81 has an 8K ROM mirrored into 0x2000-0x3FFF and RAM from 0x4000. The
 * system-variable block sits at the bottom of RAM (0x4000-0x407C), and is split
 * here the way the manual splits it: `SAVE` writes from VERSN up, so everything
 * below {@link SYSVARS_BASE} is live but never lands in a `.P` file. The BASIC
 * program, its display file, variables and the free RAM in between follow. The
 * top 32K (0x8000-0xFFFF) is the echo region the display routine "executes": an
 * address there mirrors the lower 32K (see the opcode-fetch hook in the
 * machine), so it is reserved rather than real RAM - and it mirrors ROM and RAM
 * in two halves, which is why it is drawn as two leaves.
 *
 * Every boundary here is pinned to a symbol in {@link ./sysvars} or to the
 * address masking in `./emulator/memory.ts`; a colocated test asserts it. The
 * names are the manual's own.
 *
 * Regions are contiguous, ascending and cover the whole 0x0000-0xFFFF space.
 * Leaves collapse into four bands when the viewer is zoomed out. No `udgBase`:
 * the ZX81 has no `USR "letter"` UDG area.
 *
 * Sources:
 *  - Sinclair *ZX81 BASIC Programming* (Vickers, 1981), Appendix "The system
 *    variables" - the names used here, and the note that SAVE starts at VERSN.
 *  - `./sysvars.ts` for every address, which in turn records how it was verified.
 */
export const zx81MemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  regions: [
    {
      start: 0x0000,
      end: 0x1fff,
      label: 'ROM',
      kind: 'rom',
      group: 'ROM',
      note: 'The 8K BASIC ROM. Read-only - POKEs here have no effect.',
    },
    {
      start: 0x2000,
      end: 0x3fff,
      label: 'ROM image',
      kind: 'rom',
      group: 'ROM',
      note: 'A mirror of the 8K ROM (the ZX81 only decodes the low 13 address bits here).',
    },
    {
      start: 0x4000,
      end: SYSVARS_BASE - 1,
      label: 'System variables (not saved)',
      kind: 'system',
      group: 'System variables',
      note: 'ERR_NR, FLAGS, ERR_SP, RAMTOP, MODE and PPC. They sit below VERSN, the first byte SAVE writes, so a .P file does not carry them.',
    },
    {
      start: SYSVARS_BASE,
      end: PRBUFF - 1,
      label: 'System variables (saved)',
      kind: 'system',
      group: 'System variables',
      note: 'From VERSN up: D_FILE, VARS, E_LINE, STKEND and the rest. This is the block a .P file saves ahead of the program.',
    },
    {
      start: PRBUFF,
      end: MEMBOT - 1,
      label: 'Printer buffer',
      kind: 'buffer',
      group: 'System variables',
      note: 'PRBUFF: the 33-byte line buffer the ZX Printer prints from, one character per column.',
    },
    {
      start: MEMBOT,
      end: PROGRAM_BASE - 1,
      label: "Calculator's memory area",
      kind: 'system',
      group: 'System variables',
      note: 'MEMBOT: where the ROM parks numbers that will not fit on the calculator stack.',
    },
    {
      start: PROGRAM_BASE,
      end: 0x7fff,
      label: 'Available memory',
      kind: 'program',
      note: 'The BASIC program, its display file, variables and the free RAM in between.',
    },
    {
      start: 0x8000,
      end: 0xbfff,
      label: 'Echo of ROM',
      kind: 'reserved',
      group: 'Echo region',
      note: 'Reading here returns the ROM below. The display routine "executes" this area, seeing the bytes as NOPs while the ULA paints them.',
    },
    {
      start: 0xc000,
      end: 0xffff,
      label: 'Echo of RAM',
      kind: 'reserved',
      group: 'Echo region',
      note: 'A mirror of the 16K of RAM below - the half the display routine runs through to build the picture. Not usable RAM.',
    },
  ],
};
