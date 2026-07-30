import type { MemoryMap } from '../types';

/**
 * ZX Spectrum 48K memory map for the memory-map viewer.
 *
 * The addresses are the documented, at-boot 48K layout. PROG and RAMTOP are
 * system-variable *pointers* the ROM adjusts at runtime (see {@link ./sysvars}),
 * so this static map uses their well-known 48K defaults rather than live reads:
 * the BASIC program area starts at PROG = 0x5CCB on a fresh 48K machine, and
 * RAMTOP defaults to 0xFF57 (UDGs and a little spare sit above it).
 *
 * Regions are contiguous, ascending and cover the whole 0x0000-0xFFFF space; a
 * colocated test enforces that. Leaves sharing a `group` collapse into one band
 * when the viewer is zoomed out (Screen memory = bitmap + attributes; System
 * area = printer buffer + system variables + channel information).
 *
 * Sources:
 *  - Sinclair *ZX Spectrum BASIC Programming* (Vickers), Chapter 24 and the
 *    system-variables appendix, for the display file, attributes, printer
 *    buffer, system variables and channel information, and for those names.
 *  - Logan & O'Hara, *The Complete Spectrum ROM Disassembly*, for the boundaries
 *    between them.
 *  - `./sysvars.ts` for the program base, verified against the running machine.
 */
export const spectrumMemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  // UDGs default to 0xFF58 on a fresh 48K machine (just above RAMTOP), so
  // `USR "a"` returns 0xFF58 and `POKE USR "a", n` targets that byte.
  udgBase: 0xff58,
  regions: [
    {
      start: 0x0000,
      end: 0x3fff,
      label: 'ROM',
      kind: 'rom',
      note: 'The 16K BASIC ROM. Read-only - POKEs here have no effect.',
    },
    {
      start: 0x4000,
      end: 0x57ff,
      label: 'Display file',
      kind: 'screen',
      group: 'Screen memory',
      note: 'The 6144-byte screen bitmap (one bit per pixel).',
    },
    {
      start: 0x5800,
      end: 0x5aff,
      label: 'Colour attributes',
      kind: 'attributes',
      group: 'Screen memory',
      note: 'The 768-byte attribute map: ink, paper, bright and flash per 8x8 cell.',
    },
    {
      start: 0x5b00,
      end: 0x5bff,
      label: 'Printer buffer',
      kind: 'buffer',
      group: 'System area',
      note: 'The 256-byte ZX Printer line buffer.',
    },
    {
      start: 0x5c00,
      end: 0x5cba,
      label: 'System variables',
      kind: 'system',
      group: 'System area',
      note: "The ROM's working variables (PROG, RAMTOP, cursor state and more).",
    },
    {
      start: 0x5cbb,
      end: 0x5cca,
      label: 'Channel information',
      kind: 'system',
      group: 'System area',
      note: 'Channel and stream data set up before the BASIC program area.',
    },
    {
      start: 0x5ccb,
      end: 0xff57,
      label: 'Available memory',
      kind: 'program',
      note: 'The BASIC program, its variables and the free RAM in between (PROG up to RAMTOP).',
    },
    {
      start: 0xff58,
      end: 0xffff,
      label: 'Reserved',
      kind: 'reserved',
      note: 'User-defined graphics and spare RAM above RAMTOP.',
    },
  ],
};
