import type { MemoryMap } from '../types';
import { PROGRAM_BASE } from '../cpc464/sysvars';
import { SCREEN_BASE } from '../cpc464/addresses';

/**
 * The Amstrad CPC 664 memory map for the viewer.
 *
 * The same shape as the 464's (see ../cpc464/memoryMap.ts): a flat 64K of RAM
 * with the firmware and BASIC ROMs as read-only *overlays* the Gate Array pages
 * in and out, so this shows the RAM view and notes where a ROM covers it. The
 * 664 is a 64K machine - the disc drive is what it added, not memory - so
 * nothing is banked over these addresses and there is no second bank set to
 * describe.
 *
 * Only the workspace labels differ from the 464's: the 664 was the first CPC to
 * ship BASIC 1.1, which keeps its pointers 29 bytes lower than 1.0 does, and
 * HIMEM still lands at &AB7F on a clean boot because this build runs without
 * the AMSDOS ROM. A colocated test pins the three CPC tables to each other so
 * they cannot drift silently.
 *
 * Sources: as for the 464 - SOFT968 section 2.1 (which is the 464/664/6128
 * firmware manual) and its memory-usage table, with `../cpc464/sysvars.ts` for
 * the BASIC 1.1 pointers, each verified against this machine's own ROM.
 */
export const cpc664MemoryMap: MemoryMap = {
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
      label: 'BASIC 1.1 workspace',
      kind: 'system',
      group: 'System (high)',
      note: "BASIC's own fixed workspace above HIMEM: the AUTO flags, the FOR/NEXT state and the event blocks. BASIC 1.1 holds its program and variable pointers 29 bytes below where BASIC 1.0 does.",
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
      note: 'The stack the firmware sets up immediately below the screen. On a real 664 AMSDOS reserves the space just below it for the disc drive; this build fits no AMSDOS ROM, so that space is free here - but a block placed in the stack itself is overwritten as soon as anything is called.',
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
