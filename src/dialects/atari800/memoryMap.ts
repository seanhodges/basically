// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryMap, MemoryRegion } from '../types';
import {
  ATARI_400_RAM_TOP,
  ATARI_800_RAM_TOP,
  BASIC_CARTRIDGE_BASE,
  BASIC_CARTRIDGE_BYTES,
  BASIC_WORKSPACE_BASE,
  DISPLAY_LIST_BYTES,
  GRAPHICS_0_DISPLAY_BYTES,
  HARDWARE_BASE,
  OS_ROM_BASE,
} from './addresses';

/**
 * The Atari 400/800 address space for the memory-map viewer.
 *
 * The two machines are one design with different amounts of RAM fitted, so the
 * map is built from that one figure: everything below `$0800` is the OS's and
 * BASIC's, everything above `$A000` is the cartridge and the chips, and what
 * moves between the two machines is where the program area stops and how much
 * empty socket sits above it.
 *
 * ### Where the screen is
 *
 * The Atari has no fixed screen address. The OS lays the display list and the
 * screen out downwards from the top of fitted RAM every time `GRAPHICS` is
 * called, so the two regions here are the GRAPHICS 0 screen BASIC is in at its
 * prompt - a 32-byte display list at `RAMTOP - 992` and 960 bytes of character
 * matrix above it - and a program that changes mode moves both. That is also
 * why the program area's ceiling is a figure rather than a boundary: it is
 * where the smallest screen leaves off, and every other mode takes more.
 *
 * Read off the booted machine rather than from a chart: `RAMTOP` (`$6A`),
 * `MEMTOP` (`$02E5`), `SDLSTL` (`$0230`) and `SAVMSC` (`$58`) at the BASIC
 * prompt are what the addresses below are, and `memoryMap.test.ts` boots both
 * machines and checks them again.
 */

/** The eight input/output control blocks, sixteen bytes each. */
const IOCB_BASE = 0x0340;
const IOCB_TOP = 0x03bf;

/** The OS's 40-byte printer buffer, and the spare bytes to the end of the page. */
const PRINTER_BUFFER = 0x03c0;

/** The OS's 128-byte cassette record buffer. */
const CASSETTE_BUFFER = 0x0400;

/** Low RAM the OS itself never touches; where a disk operating system loads. */
const SPARE_LOW_RAM = 0x0480;

/** `LBUFF`: the line the editor is assembling, and what a `PRINT` passes through. */
const EDITOR_LINE_BUFFER = 0x0580;

/** The page between the OS's buffers and BASIC's workspace, free by convention. */
const FREE_PAGE = 0x0600;

/** BASIC's own 256-byte buffer, which is where `LOMEM` points at the prompt. */
const BASIC_LINE_BUFFER = 0x0700;

/** Where the OS ROM's character generator sits; ANTIC fetches from here by default. */
const CHARACTER_SET_BASE = 0xe000;
const CHARACTER_SET_TOP = 0xe3ff;

/** Below the chips and above the cartridge: nothing is fitted on a 400 or an 800. */
const EMPTY_SOCKET_BASE = BASIC_CARTRIDGE_BASE + BASIC_CARTRIDGE_BYTES;

/** The regions above the program area, which are the same on both machines. */
const HARDWARE_AND_ROM: MemoryRegion[] = [
  {
    start: BASIC_CARTRIDGE_BASE,
    end: EMPTY_SOCKET_BASE - 1,
    label: 'BASIC cartridge',
    kind: 'rom',
    note: 'The 8K Atari BASIC cartridge. A 48K 800 has RAM under it, but the cartridge holds the RAM off the bus while it is fitted, so nothing can reach it.',
  },
  {
    start: EMPTY_SOCKET_BASE,
    end: HARDWARE_BASE - 1,
    label: 'Empty',
    kind: 'reserved',
    note: 'Nothing is fitted here on a 400 or an 800; the address lines are undriven and read back as 255/$FF.',
  },
  {
    start: HARDWARE_BASE,
    end: 0xd0ff,
    label: 'GTIA',
    kind: 'buffer',
    group: 'Hardware',
    note: 'Colour registers, players and missiles, the priority control, and the three console keys.',
  },
  {
    start: 0xd100,
    end: 0xd1ff,
    label: 'Parallel bus',
    kind: 'buffer',
    group: 'Hardware',
    note: 'The 800’s expansion connector. Reads back as 255/$FF with nothing plugged into it.',
  },
  {
    start: 0xd200,
    end: 0xd2ff,
    label: 'POKEY',
    kind: 'buffer',
    group: 'Hardware',
    note: 'The four sound channels, the keyboard scan, the timers, the random-number register and the serial port.',
  },
  {
    start: 0xd300,
    end: 0xd3ff,
    label: 'PIA',
    kind: 'buffer',
    group: 'Hardware',
    note: 'The 6520 the two joystick ports and the cassette motor hang off.',
  },
  {
    start: 0xd400,
    end: 0xd4ff,
    label: 'ANTIC',
    kind: 'buffer',
    group: 'Hardware',
    note: 'The display processor: DMA control, the display-list pointer, the scanline counter and WSYNC.',
  },
  {
    start: 0xd500,
    end: OS_ROM_BASE - 1,
    label: 'Cartridge control',
    kind: 'buffer',
    group: 'Hardware',
    note: 'The cartridge bank-select lines. Nothing answers here with the BASIC cartridge fitted.',
  },
  {
    start: OS_ROM_BASE,
    end: CHARACTER_SET_BASE - 1,
    label: 'Floating-point package',
    kind: 'rom',
    group: 'OS ROM',
    note: 'The six-byte BCD arithmetic every numeric expression in BASIC goes through.',
  },
  {
    start: CHARACTER_SET_BASE,
    end: CHARACTER_SET_TOP,
    label: 'Character generator',
    kind: 'rom',
    group: 'OS ROM',
    note: 'The 1K of character shapes ANTIC fetches from until a program points CHBAS somewhere else.',
  },
  {
    start: CHARACTER_SET_TOP + 1,
    end: 0xffff,
    label: 'Operating system',
    kind: 'rom',
    group: 'OS ROM',
    note: 'The device handlers, the screen editor, the interrupt service routines and the reset vectors.',
  },
];

/** The map for a machine whose RAM ends at `top`. */
export function atariMemoryMap(top: number): MemoryMap {
  const displayList = top - GRAPHICS_0_DISPLAY_BYTES;
  const screen = displayList + DISPLAY_LIST_BYTES;
  const unfitted: MemoryRegion[] =
    top < BASIC_CARTRIDGE_BASE
      ? [
          {
            start: top,
            end: BASIC_CARTRIDGE_BASE - 1,
            label: 'Unfitted RAM',
            kind: 'reserved',
            note: 'Empty sockets. The OS sizes the RAM at power-on by writing here and reading it back, and stops where the writes stop sticking.',
          },
        ]
      : [];
  return {
    addressSpace: 0x10000,
    regions: [
      {
        start: 0x0000,
        end: 0x007f,
        label: 'OS zero page',
        kind: 'system',
        group: 'System area',
        note: 'The operating system’s own page-zero variables: the cursor position, the display pointers and the interrupt working storage.',
      },
      {
        start: 0x0080,
        end: 0x00ff,
        label: 'BASIC zero page',
        kind: 'system',
        group: 'System area',
        note: 'The seven pointers that describe a program - LOMEM, VNTP, VNTD, VVTP, STMTAB, STMCUR and STARP - the runtime stack and top-of-memory pointers above them, and the floating-point package’s scratch from 212/$D4.',
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
        end: IOCB_BASE - 1,
        label: 'OS variables',
        kind: 'system',
        group: 'System area',
        note: 'Interrupt vectors, the hardware shadow registers the vertical blank copies to the chips, and the device control block the serial bus is driven through.',
      },
      {
        start: IOCB_BASE,
        end: IOCB_TOP,
        label: 'I/O control blocks',
        kind: 'system',
        group: 'System area',
        note: 'The eight IOCBs, sixteen bytes each: one open file or device apiece, with the screen editor in the first.',
      },
      {
        start: PRINTER_BUFFER,
        end: CASSETTE_BUFFER - 1,
        label: 'Printer buffer',
        kind: 'buffer',
        group: 'System area',
        note: 'The 40-character line the printer handler assembles, and the spare bytes to the end of the page.',
      },
      {
        start: CASSETTE_BUFFER,
        end: SPARE_LOW_RAM - 1,
        label: 'Cassette buffer',
        kind: 'buffer',
        group: 'Buffers and free pages',
        note: 'The 128-byte record the cassette handler reads and writes a block at a time.',
      },
      {
        start: SPARE_LOW_RAM,
        end: EDITOR_LINE_BUFFER - 1,
        label: 'Spare RAM',
        kind: 'system',
        group: 'Buffers and free pages',
        note: 'Free on a bare machine; a disk operating system loads its handler down here and pushes everything above it up.',
      },
      {
        start: EDITOR_LINE_BUFFER,
        end: FREE_PAGE - 1,
        label: 'Editor line buffer',
        kind: 'buffer',
        group: 'Buffers and free pages',
        note: 'LBUFF: the line the screen editor is assembling, and the text every PRINT passes through on its way out.',
      },
      {
        start: FREE_PAGE,
        end: BASIC_LINE_BUFFER - 1,
        label: 'Free page',
        kind: 'system',
        group: 'Buffers and free pages',
        note: 'The one page neither the OS nor BASIC writes to, which is where an Atari machine-code routine has always gone. Blocks are offered 1536/$0600 by default.',
      },
      {
        start: BASIC_LINE_BUFFER,
        end: BASIC_WORKSPACE_BASE - 1,
        label: 'BASIC line buffer',
        kind: 'system',
        group: 'Buffers and free pages',
        note: 'BASIC’s own 256-byte buffer, where it parses a typed line before adding it to the program. LOMEM points here.',
      },
      {
        start: BASIC_WORKSPACE_BASE,
        end: displayList - 1,
        label: 'BASIC program & variables',
        kind: 'program',
        note: 'Everything a program is: the variable name and value tables, the tokenized statements, then the string and array space and the runtime stack growing up behind them.',
      },
      {
        start: displayList,
        end: screen - 1,
        label: 'Display list',
        kind: 'buffer',
        note: 'The program ANTIC runs to build the picture, one instruction per row. This is the GRAPHICS 0 list; every other mode writes a different one, and both this and the screen above it move.',
      },
      {
        start: screen,
        end: top - 1,
        label: 'Screen memory',
        kind: 'screen',
        note: 'The 40x24 character matrix of the GRAPHICS 0 screen, laid out downwards from the top of fitted RAM. A graphics mode needs more and takes it from the program area below.',
      },
      ...unfitted,
      ...HARDWARE_AND_ROM,
    ],
  };
}

/** Atari 800: 48K fitted, the top 8K of it behind the BASIC cartridge. */
export const atari800MemoryMap = atariMemoryMap(ATARI_800_RAM_TOP);

/** Atari 400: the same map with RAM ending at 16K and empty sockets above it. */
export const atari400MemoryMap = atariMemoryMap(ATARI_400_RAM_TOP);
