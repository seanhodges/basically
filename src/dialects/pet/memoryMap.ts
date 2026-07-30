import type { MemoryMap } from '../types';

/**
 * Commodore PET 4032 memory map for the memory-map viewer.
 *
 * The PET (BASIC 4.0, 32 KB RAM, discrete-TTL video) sees a fixed 64K address
 * space with ROM baked in - no banking. This map describes that layout as the
 * CPU sees it at the READY prompt, which is what a BASIC program runs against:
 *
 *   $0000-$03FF  Zero page, processor stack and KERNAL/BASIC workspace
 *   $0400-$7FFF  BASIC RAM: the program text (from $0401), then variables,
 *                arrays and the string heap
 *   $8000-$8FFF  Screen RAM (40x25 screen codes, mirrored every $400)
 *   $9000-$AFFF  Expansion ROM sockets (open bus with nothing fitted)
 *   $B000-$DFFF  BASIC 4.0 ROM (three 4K banks)
 *   $E000-$E7FF  Editor ROM (40-column, 50 Hz)
 *   $E800-$EFFF  I/O: PIA1 (keyboard, retrace IRQ), PIA2 (IEEE), VIA (sound…)
 *   $F000-$FFFF  KERNAL ROM
 *
 * The three system leaves ($0000-$03FF) collapse into one "System area" band
 * when the viewer is zoomed out. The PET has no per-cell colour memory (its
 * video is monochrome), so there is no `attributes` region.
 *
 * Regions are contiguous, ascending and cover the whole $0000-$FFFF space; a
 * colocated test enforces that. The PET has no `USR "letter"` user-defined-
 * graphics area, so `udgBase` is omitted.
 *
 * Sources:
 *  - *PET/CBM Personal Computer Guide* and the BASIC 4.0 memory-map appendix
 *    for the region names and the ROM boundaries.
 *  - `./addresses.ts` and `../../emulator/pet/petMachine.ts` for the addresses.
 */
export const petMemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  regions: [
    {
      start: 0x0000,
      end: 0x00ff,
      label: 'Zero page',
      kind: 'system',
      group: 'System area',
      note: 'Page zero: the BASIC and KERNAL working pointers (TXTTAB, CURLIN and the rest).',
    },
    {
      start: 0x0100,
      end: 0x01ff,
      label: 'Processor stack',
      kind: 'system',
      group: 'System area',
      note: 'The 6502 hardware stack (page 1).',
    },
    {
      start: 0x0200,
      end: 0x03ff,
      label: 'System workspace',
      kind: 'system',
      group: 'System area',
      note: 'KERNAL and BASIC workspace: the input buffer, tape buffers and system vectors below the program area.',
    },
    {
      start: 0x0400,
      end: 0x7fff,
      label: 'BASIC program & variables',
      kind: 'program',
      note: 'BASIC RAM: the program text (from 1025/$0401) then variables, arrays and the string heap.',
    },
    {
      start: 0x8000,
      end: 0x8fff,
      label: 'Screen memory',
      kind: 'screen',
      note: 'The 40x25 video matrix from 32768/$8000 (1000 screen codes), mirrored every 1K up to $8FFF.',
    },
    {
      start: 0x9000,
      end: 0xafff,
      label: 'Expansion ROM',
      kind: 'reserved',
      note: 'The expansion/utility ROM sockets. Open bus with nothing fitted.',
    },
    {
      start: 0xb000,
      end: 0xdfff,
      label: 'BASIC ROM',
      kind: 'rom',
      note: 'The 12K BASIC 4.0 interpreter ROM (three 4K banks from $B000).',
    },
    {
      start: 0xe000,
      end: 0xe7ff,
      label: 'Editor ROM',
      kind: 'rom',
      note: 'The screen editor ROM (40-column, 50 Hz): the screen-and-keyboard driver.',
    },
    {
      start: 0xe800,
      end: 0xefff,
      label: 'I/O (PIA & VIA)',
      kind: 'buffer',
      note: 'The memory-mapped chips: PIA1 (keyboard scan, retrace IRQ), PIA2 (the IEEE-488 bus) and the 6522 VIA (sound, handshake).',
    },
    {
      start: 0xf000,
      end: 0xffff,
      label: 'KERNAL ROM',
      kind: 'rom',
      note: 'The 4K KERNAL operating-system ROM.',
    },
  ],
};
