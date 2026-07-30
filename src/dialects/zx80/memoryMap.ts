import type { MemoryMap } from '../types';
import { VARS, DF_EA, PROGRAM_BASE } from './sysvars';

/**
 * ZX80 memory map for the memory-map viewer, as the base 16K machine sees it
 * (the IDE always builds the ZX80 with a 16K RAM pack).
 *
 * The ZX80 has a 4K ROM (a quarter the ZX81's) mirrored up to 0x3FFF, and RAM
 * from 0x4000. Its 40-byte system-variable block occupies 0x4000-0x4027; user
 * memory - the BASIC program, variables, edit line and the display file the ROM
 * rebuilds on top - begins at {@link PROGRAM_BASE}. The top 32K (0x8000-0xFFFF)
 * is the echo region the display routine "executes": an address there mirrors
 * the lower 32K (see the opcode-fetch hook in the machine), so it is reserved
 * rather than real RAM - and because the lower 32K is ROM then RAM, the echo
 * above it is drawn as two leaves rather than one.
 *
 * The system-variable block is split only as far as the machine's documentation
 * goes. {@link ./sysvars} names the pointers up to {@link DF_EA} and records that
 * they were confirmed by booting the real ROM; nothing names what the ROM keeps
 * in the bytes above them, so that leaf says so rather than inventing a purpose.
 *
 * Regions are contiguous, ascending and cover the whole 0x0000-0xFFFF space; a
 * colocated test enforces that. Leaves collapse into four bands when the viewer
 * is zoomed out. No `udgBase`: the ZX80 has no `USR "letter"` UDG area.
 *
 * Sources:
 *  - *ZX80 Operating Manual* for the machine's own account of user memory.
 *  - `./sysvars.ts` for every address, which records how each was verified
 *    against the real ROM.
 */
export const zx80MemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  regions: [
    {
      start: 0x0000,
      end: 0x0fff,
      label: 'ROM',
      kind: 'rom',
      group: 'ROM',
      note: 'The 4K BASIC ROM. Read-only - POKEs here have no effect.',
    },
    {
      start: 0x1000,
      end: 0x3fff,
      label: 'ROM image',
      kind: 'rom',
      group: 'ROM',
      note: 'Mirrors of the 4K ROM (the ZX80 only decodes the low 12 address bits here).',
    },
    {
      start: 0x4000,
      end: VARS - 1,
      label: 'System variables',
      kind: 'system',
      group: 'System variables',
      note: "The interpreter's own cells: the report code, the flags byte and the line number being executed.",
    },
    {
      start: VARS,
      end: DF_EA + 1,
      label: 'Program and display pointers',
      kind: 'system',
      group: 'System variables',
      note: 'VARS, E_LINE, D_FILE, DF_END and DF_EA - where the variables, the edit line and the display file each begin.',
    },
    {
      start: DF_EA + 2,
      end: PROGRAM_BASE - 1,
      label: 'Workspace (undocumented)',
      kind: 'system',
      group: 'System variables',
      note: 'The rest of the 40-byte block. The ZX80 manual does not document what the ROM keeps here, so this map does not guess.',
    },
    {
      start: PROGRAM_BASE,
      end: 0x7fff,
      label: 'Available memory',
      kind: 'program',
      note: 'The BASIC program, its variables, edit line and the display file above them.',
    },
    {
      start: 0x8000,
      end: 0xbfff,
      label: 'Echo of ROM',
      kind: 'reserved',
      group: 'Echo region',
      note: 'Reading here returns the ROM below. The display routine "executes" this area, seeing the bytes as NOPs while the picture is painted.',
    },
    {
      start: 0xc000,
      end: 0xffff,
      label: 'Echo of RAM',
      kind: 'reserved',
      group: 'Echo region',
      note: 'A mirror of the 16K of RAM below - the half the display routine runs through. Not usable RAM.',
    },
  ],
};
