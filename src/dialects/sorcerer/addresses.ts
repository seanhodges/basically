// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Exidy Sorcerer's fixed addresses and I/O ports, declared once for the
 * whole dialect, so a layout fact has exactly one definition to change.
 *
 * The hardware constants below are transcribed from the Sorcerer Technical
 * Manual (Exidy Inc., March 1979) and the Sorcerer Software Manual (April
 * 1979). The interpreter's own workspace addresses - its reserved-word table
 * and the control-area pointers the variable watcher needs - are deliberately
 * *not* here yet: they must be read out of the ROM PAC image and off the booted
 * machine, and a plausible-looking guess in this file would propagate silently
 * into the memory map, the linter and the emulator.
 *
 * Note the machine's unusual shape, which is what makes it worth having this
 * file before anything reads it: the Sorcerer's character generator is half ROM
 * and half RAM. Codes 0-127 come from {@link CHARGEN_ROM_BASE}, and codes
 * 128-255 are *bitmaps in RAM* at {@link CHARGEN_RAM_BASE} - the Monitor copies
 * the "standard" graphics set into the lower half of that RAM at boot, so those
 * shapes are a convention a running program may overwrite rather than a fixed
 * font.
 */

/** Bottom of fitted RAM. The Sorcerer's address space starts in RAM. */
export const RAM_BASE = 0x0000;

/** The BASIC control area - the interpreter's own workspace pointers. */
export const BASIC_CONTROL_BASE = 0x0100;

/** Last byte of the BASIC control area. */
export const BASIC_CONTROL_END = 0x014e;

/** Where Exidy Standard BASIC keeps its tokenized program text. */
export const PROGRAM_BASE = 0x01d5;

/** The ROM PAC cartridge window, which Standard BASIC occupies. */
export const ROM_PAC_BASE = 0xc000;

/** Size of a ROM PAC. */
export const ROM_PAC_SIZE = 0x2000;

/** The on-board Monitor ROM. */
export const MONITOR_BASE = 0xe000;

/** Size of the Monitor ROM. */
export const MONITOR_SIZE = 0x1000;

/** The Monitor's workarea and system variables, below screen RAM. */
export const MONITOR_WORKAREA_BASE = 0xf000;

/**
 * Bytes at the top of *fitted* RAM the Monitor also claims, which is what keeps
 * the BASIC program area clear of it. Distinct from
 * {@link MONITOR_WORKAREA_BASE}, which is the fixed area below screen RAM.
 */
export const MONITOR_RAM_TAIL_BYTES = 0x6e;

/** Screen RAM: 64 columns x 30 rows, one character code per byte. */
export const SCREEN_BASE = 0xf080;

/** Characters per screen row. */
export const SCREEN_COLUMNS = 64;

/** Screen rows. */
export const SCREEN_ROWS = 30;

/** Character generator ROM - the bitmaps for codes 0-127. */
export const CHARGEN_ROM_BASE = 0xf800;

/** Character generator RAM - the bitmaps for codes 128-255. */
export const CHARGEN_RAM_BASE = 0xfc00;

/** Scan lines in one character cell, and so bytes per generator entry. */
export const CHAR_CELL_HEIGHT = 8;

/** Dots across one character cell. */
export const CHAR_CELL_WIDTH = 8;

/** Data port: cassette and RS-232 bytes pass through here. */
export const PORT_DATA = 0xfc;

/** Status port for the same UART. */
export const PORT_STATUS = 0xfd;

/**
 * Control port: selects RS-232 or dual cassette and the baud rate on output,
 * and is the port the keyboard is scanned through on input. Bit 0x20 reads back
 * the video VSYNC state.
 */
export const PORT_CONTROL = 0xfe;

/** The 8-bit parallel port. */
export const PORT_PARALLEL = 0xff;

/** VSYNC indicator, on reads of {@link PORT_CONTROL}. */
export const CONTROL_VSYNC_BIT = 0x20;
