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

// ---------------------------------------------------------------------------
// Read out of the ROM PAC image
// ---------------------------------------------------------------------------

/**
 * The interpreter's reserved-word table: each entry is its spelling with bit 7
 * set on the *first* character, entries run back to back in token order from
 * END = {@link TOKEN_BASE}, and a lone 0x80 byte at {@link RESERVED_WORDS_END}
 * closes the list after MID$.
 *
 * The bound is not a guess about where the table stops: the ROM's own CRUNCH
 * routine loads `DE` with `RESERVED_WORDS_BASE - 1` and `B` with
 * `TOKEN_BASE - 1` before walking it, and stops on that lone 0x80.
 */
export const RESERVED_WORDS_BASE = 0xc0f6;

/** The lone 0x80 byte that closes the reserved-word table. */
export const RESERVED_WORDS_END = 0xc1e0;

/** The token byte the first reserved word (END) is stored as. */
export const TOKEN_BASE = 0x80;

/**
 * The statement dispatch table, one little-endian address per command token
 * from {@link TOKEN_BASE}. Its length is what separates the commands from the
 * functions and operators above them, and its fifth entry is the second reading
 * that fixes the whole table's numbering: BYE dispatches to 0xE003, an entry in
 * the Monitor's own jump table, which no other token could plausibly reach.
 */
export const STATEMENT_TABLE_BASE = 0xc1e1;

/** Command tokens, and so entries in {@link STATEMENT_TABLE_BASE}: END..NEW. */
export const STATEMENT_TABLE_ENTRIES = 30;

/**
 * The largest line number the interpreter will accept. Its line-number scanner
 * refuses a running value above 6552 before multiplying by ten and adding the
 * next digit, so 6552 * 10 + 9 is the ceiling.
 */
export const MAX_LINE_NUMBER = 65529;

/**
 * The ROM image of the BASIC control area, copied to {@link BASIC_CONTROL_BASE}
 * by the ROM PAC's first instructions - which is why nothing in the PAC is ever
 * seen to *write* the pointers below. The copy is
 * {@link CONTROL_AREA_IMAGE_BYTES} long, so it initialises 0x0100-0x014D.
 */
export const CONTROL_AREA_IMAGE_BASE = 0xc258;

/** Bytes the cold start copies to {@link BASIC_CONTROL_BASE}. */
export const CONTROL_AREA_IMAGE_BYTES = 0x4e;

/**
 * TXTTAB - where the interpreter looks for the start of the program text. It
 * sits in the control area and its image byte holds {@link PROGRAM_BASE}, which
 * is where that constant is confirmed from rather than assumed.
 */
export const TXTTAB = 0x0149;

/**
 * VARTAB - the first byte past the program, and so where scalar variables
 * start. Unlike TXTTAB this is outside the documented control area, in the
 * interpreter's own workspace above it; NEW writes it two bytes past TXTTAB
 * after storing an empty program's 0x0000 link.
 */
export const VARTAB = 0x01b7;

/** ARYTAB - the first byte past the scalars, where arrays start. */
export const ARYTAB = 0x01b9;

/** STREND - the first byte past the arrays, the end of storage in use. */
export const STREND = 0x01bb;

// ---------------------------------------------------------------------------
// The character bands
// ---------------------------------------------------------------------------

/**
 * Where the Monitor's copy of the standard graphics set lives in its own ROM.
 * At boot it moves {@link STANDARD_GRAPHICS_COUNT} eight-byte bitmaps from here
 * to {@link CHARGEN_RAM_BASE}, which is why codes 128-191 have shapes at all
 * and why a running program can replace them.
 */
export const STANDARD_GRAPHICS_BITMAPS = 0xedfe;

/** First code of the standard graphics set. */
export const STANDARD_GRAPHICS_FIRST = 0x80;

/** Last code of the standard graphics set. */
export const STANDARD_GRAPHICS_LAST = 0xbf;

/** Characters in the standard graphics set. */
export const STANDARD_GRAPHICS_COUNT =
  STANDARD_GRAPHICS_LAST - STANDARD_GRAPHICS_FIRST + 1;

/**
 * First code of the user-definable set. The Monitor leaves the generator RAM
 * from here up as it found it, so these codes have no shapes until a program
 * pokes some in.
 */
export const USER_GRAPHICS_FIRST = 0xc0;

/** Last code of the user-definable set, and the last code the machine has. */
export const USER_GRAPHICS_LAST = 0xff;

/** Last code of the band of fixed pictorial symbols in the generator ROM. */
export const FIXED_SYMBOLS_LAST = 0x1f;
