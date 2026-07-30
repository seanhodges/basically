import type { MemoryMap } from '../types';

/**
 * Commodore 64 memory map for the memory-map viewer.
 *
 * The C64 has 64K of RAM but the 6510 only ever sees 64K of address space, with
 * ROM and I/O banked in over the top of RAM by the processor port at $00/$01.
 * This map describes the **default power-on banking** the CPU sees at the READY
 * prompt - BASIC ROM, I/O and KERNAL ROM all visible - which is what a BASIC
 * program runs against:
 *
 *   $0000-$00FF  Zero page (incl. the $00/$01 processor port and the BASIC /
 *                KERNAL zero-page pointers)
 *   $0100-$01FF  Processor (6510) stack
 *   $0200-$03FF  OS + BASIC workspace: input buffer, system vectors, variables
 *   $0400-$07FF  Default screen matrix (1000 chars from $0400) + sprite pointers
 *   $0800-$9FFF  BASIC RAM: the program text (from $0801), then variables,
 *                arrays and the string heap - the 38911 bytes FREE reports
 *   $A000-$BFFF  BASIC ROM (banks out to RAM)
 *   $C000-$CFFF  Upper RAM, unused by BASIC (commonly holds machine code)
 *   $D000-$DFFF  I/O: VIC-II, SID, colour RAM, CIA 1/2 and the expansion ports
 *                (banks to the character ROM or RAM)
 *   $E000-$FFFF  KERNAL ROM (banks out to RAM)
 *
 * The three system leaves ($0000-$03FF) collapse into one "System area" band,
 * and the six I/O leaves ($D000-$DFFF) into one "I/O area" band, when the viewer
 * is zoomed out. Colour RAM is the C64's per-cell attribute area, so it carries
 * the `attributes` colour when zoomed in.
 *
 * Regions are contiguous, ascending and cover the whole $0000-$FFFF space; a
 * colocated test enforces that. The C64 has no `USR "letter"` user-defined-
 * graphics area, so `udgBase` is omitted.
 *
 * Sources:
 *  - *Commodore 64 Programmer's Reference Guide*, the memory-map appendix and
 *    the chip register chapters, for the region names and boundaries.
 *  - Leemon, *Mapping the Commodore 64*, for the workspace subdivisions.
 *  - `./addresses.ts` for the BASIC RAM base and screen base.
 */
export const c64MemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  regions: [
    {
      start: 0x0000,
      end: 0x00ff,
      label: 'Zero page',
      kind: 'system',
      group: 'System area',
      note: 'Page zero: the $00/$01 processor port (memory banking) and the BASIC/KERNAL working pointers.',
    },
    {
      start: 0x0100,
      end: 0x01ff,
      label: 'Processor stack',
      kind: 'system',
      group: 'System area',
      note: 'The 6510 hardware stack (page 1).',
    },
    {
      start: 0x0200,
      end: 0x03ff,
      label: 'System workspace',
      kind: 'system',
      group: 'System area',
      note: 'OS and BASIC workspace: the input buffer, system vectors and variables below screen memory.',
    },
    {
      start: 0x0400,
      end: 0x07ff,
      label: 'Screen memory',
      kind: 'screen',
      note: 'Default video matrix: 1000 screen codes from 1024/$0400, with the sprite pointers at its top.',
    },
    {
      start: 0x0800,
      end: 0x9fff,
      label: 'BASIC program & variables',
      kind: 'program',
      note: 'BASIC RAM: the program text (from $0801) then variables, arrays and the string heap - the 38911 bytes FRE reports.',
    },
    {
      start: 0xa000,
      end: 0xbfff,
      label: 'BASIC ROM',
      kind: 'rom',
      note: 'The 8K BASIC interpreter ROM; can be banked out to reveal the RAM beneath.',
    },
    {
      start: 0xc000,
      end: 0xcfff,
      label: 'Upper RAM',
      kind: 'reserved',
      note: '4K of RAM above BASIC, left free by the interpreter - a common home for machine code.',
    },
    {
      start: 0xd000,
      end: 0xd3ff,
      label: 'VIC-II registers',
      kind: 'buffer',
      group: 'I/O area',
      note: 'The video chip: border 53280/$D020, background 53281/$D021, sprites and raster.',
    },
    {
      start: 0xd400,
      end: 0xd7ff,
      label: 'SID registers',
      kind: 'buffer',
      group: 'I/O area',
      note: 'The sound chip from 54272/$D400: three voices, filter and volume.',
    },
    {
      start: 0xd800,
      end: 0xdbff,
      label: 'Colour RAM',
      kind: 'attributes',
      group: 'I/O area',
      note: "The C64's per-cell colour (attribute) memory from 55296/$D800, one nibble per screen cell.",
    },
    {
      start: 0xdc00,
      end: 0xdcff,
      label: 'CIA 1',
      kind: 'buffer',
      group: 'I/O area',
      note: 'Complex Interface Adapter 1 ($DC00): keyboard and joystick matrix, timers, the IRQ source.',
    },
    {
      start: 0xdd00,
      end: 0xddff,
      label: 'CIA 2',
      kind: 'buffer',
      group: 'I/O area',
      note: 'Complex Interface Adapter 2 ($DD00): the serial bus, the user port and the VIC memory bank.',
    },
    {
      start: 0xde00,
      end: 0xdfff,
      label: 'I/O expansion',
      kind: 'buffer',
      group: 'I/O area',
      note: 'The I/O-1 and I/O-2 expansion areas ($DE00-$DFFF) for cartridge hardware.',
    },
    {
      start: 0xe000,
      end: 0xffff,
      label: 'KERNAL ROM',
      kind: 'rom',
      note: 'The 8K KERNAL operating-system ROM; can be banked out to reveal the RAM beneath.',
    },
  ],
};
