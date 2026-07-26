import type { MemoryMap } from '../types';

/**
 * The Amstrad CPC 6128 memory map for the viewer.
 *
 * The same shape as the 464's (see ../cpc464/memoryMap.ts): a flat 64K of RAM
 * with the firmware and BASIC ROMs as read-only *overlays* the Gate Array pages
 * in and out, so this shows the RAM view and notes where a ROM covers it. Only
 * the workspace labels differ - BASIC 1.1 keeps its pointers 29 bytes lower
 * than 1.0 - and HIMEM lands at the same &AB7F on a clean boot.
 *
 * The second 64K stays out of the bands. `addressSpace` is what a CPU address
 * means, and the 6128's extra RAM is not more address space: it is four 16K
 * banks the PAL windows *over* these same addresses. Drawing 128K linearly
 * would claim addresses the CPU cannot name. The Spectrum 128 map takes the
 * same line; the banking is described in the region notes instead. Regions are
 * contiguous, ascending and cover the whole 0x0000-0xFFFF space; a colocated
 * test enforces that.
 */
export const cpc6128MemoryMap: MemoryMap = {
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
      note: 'The BASIC program (from &0170), its variables and arrays, and the string heap descending from HIMEM (&AB7F on a clean boot). PRINT FRE(0) reports the free RAM in between. This is the base 64K - BASIC itself never uses the second.',
    },
    {
      start: 0xab80,
      end: 0xbfff,
      label: 'BASIC 1.1 workspace & firmware jumpblocks',
      kind: 'system',
      group: 'System (high)',
      note: "BASIC's fixed workspace above HIMEM, the firmware system variables and the &BB00+ firmware jumpblock (indirections and RSX entries). BASIC 1.1 holds its program and variable pointers 29 bytes below where BASIC 1.0 does.",
    },
    {
      start: 0xc000,
      end: 0xffff,
      label: 'Screen memory',
      kind: 'screen',
      note: 'The 16K screen bitmap (Modes 0/1/2) at its power-on address. The BASIC ROM overlays this for reads, so the firmware pages it out to draw; POKEs always reach the screen RAM. The display always reads the base 64K, whatever RAM configuration the CPU has selected.',
    },
  ],
};
