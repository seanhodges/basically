import type { MemoryMap } from '../types';
import { PROGRAM_BASE } from './sysvars';
import { SCREEN_BASE } from './addresses';

/**
 * The Amstrad CPC 464 memory map for the viewer.
 *
 * The CPC is a flat 64K of RAM; its two 16K ROMs (firmware at &0000-&3FFF,
 * Locomotive BASIC at &C000-&FFFF) are read-only *overlays* the Gate Array pages
 * in and out - writes always land in the underlying RAM. So, like the Spectrum
 * 128 paging map, this shows the RAM view and notes where a ROM overlays it,
 * rather than drawing the ROM as its own band.
 *
 * The program area, its variables/arrays and the string heap that descends from
 * HIMEM all share one "Available memory" band (&0170 up to the default HIMEM
 * &AB7F): their boundaries move at runtime, exactly as the Spectrum map folds
 * PROG...RAMTOP into a single region.
 *
 * Above HIMEM the firmware manual distinguishes four areas, so four leaves are
 * drawn: BASIC's own workspace, the high kernel jumpblock at &B900, the main
 * firmware jumpblock at &BB00 (the one a machine-code program CALLs into), and
 * the machine stack immediately below the screen.
 *
 * Regions are contiguous, ascending and cover the whole 0x0000-0xFFFF space; a
 * colocated test enforces that. Leaves collapse into four bands when zoomed out.
 *
 * Sources:
 *  - SOFT968, *The Amstrad CPC464/664/6128 Firmware Manual*, section 2.1
 *    "Memory Map": the restart block, which it describes as "the firmware area
 *    between #0000 and #003F ... set up so that the restarts operate whatever
 *    the current ROM state is"; "the HIGH area starting at #B900"; the firmware
 *    jumpblock "which starts at location #BB00"; and "a stack area immediately
 *    below #C000 which is over 256 bytes long".
 *  - The same manual's memory-usage table for &0040-&016F, the "ROM lower
 *    foreground area / BASIC input area (tokenised)", &130 bytes long. Note it
 *    is ONE area - the manual does not subdivide it at &0100, and neither does
 *    this map.
 *  - `./sysvars.ts` for the program base and the workspace pointers, each
 *    verified against the real ROM.
 */
export const cpc464MemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  regions: [
    {
      start: 0x0000,
      end: 0x003f,
      label: 'Restart block',
      kind: 'system',
      group: 'Firmware workspace',
      note: 'The Z80 RST entry points, set up so the restarts work whatever the current ROM state is. The firmware ROM overlays this area for CPU reads.',
    },
    {
      start: 0x0040,
      end: PROGRAM_BASE - 1,
      label: 'BASIC input area',
      kind: 'system',
      group: 'Firmware workspace',
      note: "The ROM lower foreground area: BASIC's tokenised input line and the scratch below the program. Overlaid by the firmware ROM for reads; POKEs still reach the RAM beneath.",
    },
    {
      start: PROGRAM_BASE,
      end: 0xab7f,
      label: 'Available memory',
      kind: 'program',
      note: 'The BASIC program (from &0170), its variables and arrays, and the string heap descending from HIMEM (&AB7F on a clean boot). PRINT FRE(0) reports the free RAM in between.',
    },
    {
      start: 0xab80,
      end: 0xb8ff,
      label: 'BASIC workspace',
      kind: 'system',
      group: 'System (high)',
      note: "BASIC's own fixed workspace above HIMEM: the AUTO flags, the FOR/NEXT state and the event blocks.",
    },
    {
      start: 0xb900,
      end: 0xbaff,
      label: 'High kernel jumpblock',
      kind: 'system',
      group: 'System (high)',
      note: 'The HIGH kernel jumpblock from &B900 - the entry points that work whatever the ROM state - and the firmware system variables beside it.',
    },
    {
      start: 0xbb00,
      end: 0xbdff,
      label: 'Main firmware jumpblock',
      kind: 'system',
      group: 'System (high)',
      note: 'The main firmware jumpblock from &BB00: key manager, text and graphics VDU, screen and sound, plus the indirections and RSX entries. This is what a machine-code program CALLs into.',
    },
    {
      start: 0xbe00,
      end: 0xbfff,
      label: 'Machine stack',
      kind: 'system',
      group: 'System (high)',
      note: 'The stack the firmware sets up immediately below the screen. A block placed here is overwritten as soon as anything is called.',
    },
    {
      start: SCREEN_BASE,
      end: 0xffff,
      label: 'Screen memory',
      kind: 'screen',
      note: 'The 16K screen bitmap (Modes 0/1/2) at its power-on address. The BASIC ROM overlays this for reads, so the firmware pages it out to draw; POKEs always reach the screen RAM. The bitmap is not linear: the CRTC interleaves it as eight 2K blocks, one per raster line of a character row, so &C000 + r*&800 holds line r of every row.',
    },
  ],
};
