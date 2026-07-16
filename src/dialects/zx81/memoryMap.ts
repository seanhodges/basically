import type { MemoryMap } from '../types';

/**
 * ZX81 memory map for the memory-map viewer, as the base 16K machine sees it
 * (the IDE always builds the ZX81 with a 16K RAM pack).
 *
 * The ZX81 has an 8K ROM mirrored into 0x2000-0x3FFF and RAM from 0x4000. The
 * system-variable block sits at the bottom of RAM (0x4000-0x407C: ERR_NR, RAMTOP
 * and PPC below VERSN at 0x4009, up to just under PROGRAM_BASE = 0x407D - see
 * {@link ./sysvars}); the BASIC program, its display file, variables and the
 * free RAM in between follow. The top 32K (0x8000-0xFFFF) is the echo region the
 * display routine "executes": an address there mirrors the lower 32K (see the
 * opcode-fetch hook in the machine), so it is reserved rather than real RAM.
 *
 * Regions are contiguous, ascending and cover the whole 0x0000-0xFFFF space; a
 * colocated test enforces that. The two ROM leaves collapse into one band when
 * the viewer is zoomed out. No `udgBase`: the ZX81 has no `USR "letter"` UDG area.
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
      end: 0x407c,
      label: 'System variables',
      kind: 'system',
      note: "The ROM's working variables (RAMTOP, D_FILE, VARS, E_LINE and more).",
    },
    {
      start: 0x407d,
      end: 0x7fff,
      label: 'Available memory',
      kind: 'program',
      note: 'The BASIC program, its display file, variables and the free RAM in between.',
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
