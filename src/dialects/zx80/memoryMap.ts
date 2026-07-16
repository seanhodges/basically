import type { MemoryMap } from '../types';

/**
 * ZX80 memory map for the memory-map viewer, as the base 16K machine sees it
 * (the IDE always builds the ZX80 with a 16K RAM pack).
 *
 * The ZX80 has a 4K ROM (a quarter the ZX81's) mirrored up to 0x3FFF, and RAM
 * from 0x4000. Its 40-byte system-variable block occupies 0x4000-0x4027; user
 * memory - the BASIC program, variables, edit line and the display file the ROM
 * rebuilds on top - begins at PROGRAM_BASE = 0x4028 (see {@link ./sysvars}). The
 * top 32K (0x8000-0xFFFF) is the echo region the display routine "executes": an
 * address there mirrors the lower 32K (see the opcode-fetch hook in the machine),
 * so it is reserved rather than real RAM.
 *
 * Regions are contiguous, ascending and cover the whole 0x0000-0xFFFF space; a
 * colocated test enforces that. The two ROM leaves collapse into one band when
 * the viewer is zoomed out. No `udgBase`: the ZX80 has no `USR "letter"` UDG area.
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
      end: 0x4027,
      label: 'System variables',
      kind: 'system',
      note: "The ROM's 40-byte working-variable block (VARS, E_LINE, D_FILE and more).",
    },
    {
      start: 0x4028,
      end: 0x7fff,
      label: 'Available memory',
      kind: 'program',
      note: 'The BASIC program, its variables, edit line and the display file above them.',
    },
    {
      start: 0x8000,
      end: 0xffff,
      label: 'Echo region',
      kind: 'reserved',
      note: 'A mirror of the lower 32K that the ROM "executes" to build the display - not usable RAM.',
    },
  ],
};
