import type { MemoryMap } from '../types';

/**
 * ZX Spectrum 128K memory map for the memory-map viewer.
 *
 * The 128K pages 16K banks through a fixed CPU window (see the {@link
 * ./emulator/memory128} header):
 *   0x0000-0x3FFF  ROM    - bank 0 (128 editor) or bank 1 (48 BASIC), by port 0x7FFD
 *   0x4000-0x7FFF  RAM    - bank 5 (screen + the 48-style system area + program)
 *   0x8000-0xBFFF  RAM    - bank 2
 *   0xC000-0xFFFF  RAM    - whichever of banks 0-7 port 0x7FFD selects
 *
 * The low 0x4000-0x5CCB of bank 5 mirrors the 48K layout (screen bitmap,
 * attributes, printer buffer, system variables, channel information), so those
 * boundaries are shared with {@link ../zxspectrum/memoryMap}. The three RAM
 * spans above the system area collapse into one "Available memory" band when the
 * viewer is zoomed out.
 *
 * Regions are contiguous, ascending and cover the whole 0x0000-0xFFFF space; a
 * colocated test enforces that. `udgBase` carries over the 48K default (0xFF58):
 * 128 BASIC keeps user-defined graphics just below RAMTOP, in the paged window.
 */
export const spectrum128MemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  udgBase: 0xff58,
  regions: [
    {
      start: 0x0000,
      end: 0x3fff,
      label: 'ROM',
      kind: 'rom',
      note: 'The paged 16K ROM (128 editor or 48 BASIC, selected by port 0x7FFD). Read-only.',
    },
    {
      start: 0x4000,
      end: 0x57ff,
      label: 'Display file',
      kind: 'screen',
      group: 'Screen memory',
      note: 'The 6144-byte screen bitmap in bank 5 (one bit per pixel).',
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
      note: 'The 256-byte printer line buffer.',
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
      end: 0x7fff,
      label: 'Available memory (bank 5)',
      kind: 'program',
      group: 'Available memory',
      note: 'The BASIC program and variables in the fixed bank-5 window (PROG upward).',
    },
    {
      start: 0x8000,
      end: 0xbfff,
      label: 'RAM bank 2',
      kind: 'program',
      group: 'Available memory',
      note: 'The fixed 16K RAM window at 0x8000 (bank 2).',
    },
    {
      start: 0xc000,
      end: 0xffff,
      label: 'Paged RAM',
      kind: 'program',
      group: 'Available memory',
      note: 'The 16K bank (0-7) selected by port 0x7FFD; user-defined graphics sit near its top.',
    },
  ],
};
