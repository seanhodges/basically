import type { MemoryMap } from '../types';

/**
 * The Amstrad CPC 464 memory map for the viewer.
 *
 * The CPC is a flat 64K of RAM; its two 16K ROMs (firmware at &0000–&3FFF,
 * Locomotive BASIC at &C000–&FFFF) are read-only *overlays* the Gate Array pages
 * in and out - writes always land in the underlying RAM. So, like the Spectrum
 * 128 paging map, this shows the RAM view and notes where a ROM overlays it,
 * rather than drawing the ROM as its own band.
 *
 * The program area, its variables/arrays and the string heap that descends from
 * HIMEM all share one "Available memory" band (&0170 up to the default HIMEM
 * &AB7F): their boundaries move at runtime, exactly as the Spectrum map folds
 * PROG…RAMTOP into a single region. Regions are contiguous, ascending and cover
 * the whole 0x0000–0xFFFF space; a colocated test enforces that.
 */
export const cpc464MemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  regions: [
    {
      start: 0x0000,
      end: 0x003f,
      label: 'Restart & interrupt vectors',
      kind: 'system',
      group: 'Firmware workspace',
      note: 'The Z80 RST entry points the firmware uses for its jumpblock calls. The firmware ROM overlays this area for CPU reads.',
    },
    {
      start: 0x0040,
      end: 0x016f,
      label: 'Firmware & BASIC workspace',
      kind: 'system',
      group: 'Firmware workspace',
      note: 'The OS and BASIC scratch variables below the program area. Overlaid by the firmware ROM for reads; POKEs still reach the RAM beneath.',
    },
    {
      start: 0x0170,
      end: 0xab7f,
      label: 'Available memory',
      kind: 'program',
      note: 'The BASIC program (from &0170), its variables and arrays, and the string heap descending from HIMEM (&AB7F on a clean boot). PRINT FRE(0) reports the free RAM in between.',
    },
    {
      start: 0xab80,
      end: 0xbfff,
      label: 'BASIC workspace & firmware jumpblocks',
      kind: 'system',
      group: 'System (high)',
      note: "BASIC's fixed workspace above HIMEM, the firmware system variables and the &BB00+ firmware jumpblock (indirections and RSX entries).",
    },
    {
      start: 0xc000,
      end: 0xffff,
      label: 'Screen memory',
      kind: 'screen',
      note: 'The 16K screen bitmap (Modes 0/1/2) at its power-on address. The BASIC ROM overlays this for reads, so the firmware pages it out to draw; POKEs always reach the screen RAM.',
    },
  ],
};
