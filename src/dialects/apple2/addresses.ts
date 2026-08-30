// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Where everything lives on an Apple II, and what each number was read from.
 *
 * Every value below was read back off the running machine: `public/roms/apple2.rom`
 * was booted on the vendored 6502 core, driven through the monitor into Integer
 * BASIC with `E000G`, fed program lines through the keyboard latch and then
 * dumped - so the pointers, the bounds and the line format are what the
 * interpreter itself does rather than what a manual says it does.
 */

/** RAM fitted on the board, 48K in one contiguous run. */
export const RAM_BASE = 0x0000;
export const RAM_TOP = 0xbfff;

/** The I/O page. Reads have side effects here as often as writes do. */
export const IO_BASE = 0xc000;
export const IO_TOP = 0xcfff;

/**
 * The ROM window, and the three sockets inside it that hold something.
 * `$D800`-`$DFFF` is the unpopulated half of the Programmer's Aid socket and
 * reads as `$FF`; see `public/roms/ATTRIBUTION.md`.
 */
export const ROM_BASE = 0xd000;
export const ROM_TOP = 0xffff;
export const PROGRAMMERS_AID_BASE = 0xd000;
export const BASIC_BASE = 0xe000;
export const BASIC_TOP = 0xf7ff;
export const MONITOR_BASE = 0xf800;

/** One image covering the whole window, in address order. */
export const FIRMWARE_BYTES = ROM_TOP - ROM_BASE + 1;

/** Integer BASIC's cold start, typed at the monitor as `E000G`. */
export const BASIC_COLD_ENTRY = 0xe000;

/** Display pages. Text and lo-res share one; hi-res has its own. */
export const TEXT_PAGE1 = 0x0400;
export const TEXT_PAGE2 = 0x0800;
export const HIRES_PAGE1 = 0x2000;
export const HIRES_PAGE2 = 0x4000;

/** The hi-res raster the text and lo-res pages are also drawn into. */
export const DISPLAY_WIDTH = 280;
export const DISPLAY_HEIGHT = 192;

/**
 * Zero-page pointers Integer BASIC keeps its workspace in.
 *
 * The program grows **down** from HIMEM and the variables grow **up** from
 * LOMEM, so PP is the lowest byte of program text and PV the first free byte
 * above the variables; the two meet in the middle and a program that fills the
 * gap answers `*** MEM FULL ERR`.
 */
export const LOMEM = 0x004a;
export const HIMEM = 0x004c;
/** Lowest byte of stored program text (program text runs PP..HIMEM-1). */
export const PP = 0x00ca;
/** First free byte above the variable table (variables run LOMEM..PV-1). */
export const PV = 0x00cc;
/**
 * Pointer to the record of the line being executed - its length byte, not its
 * first token. Read off a running program: with `10 FOR I=1 TO 20000` /
 * `20 NEXT I` stored at `$BFE7`, this holds `$BFF5`, which is where line 20's
 * record begins.
 */
export const PLINE = 0x00dc;

/** Cold-start LOMEM/HIMEM, and the space they leave a program. */
export const DEFAULT_LOMEM = 0x0800;
export const DEFAULT_HIMEM = 0xc000;
export const COLD_START_BYTES_FREE = DEFAULT_HIMEM - DEFAULT_LOMEM;

/**
 * Lowest address a workspace may start at.
 *
 * The interpreter itself imposes none - `LOMEM:768` is accepted and moves the
 * variable table to `$0300` - but text page 1 is at `$0400`-`$07FF` and the
 * monitor's line buffer at `$0200`-`$02FF`, so a workspace below `$0800` is
 * overwritten by the machine's own printing. `$0800` is where the cold start
 * puts it and the lowest address it can keep.
 */
export const MIN_LOMEM = TEXT_PAGE2;

/**
 * One past the highest address HIMEM may reach. HIMEM is an exclusive top and
 * `$BFFF` is the last byte of RAM, so a program may claim all of it and no
 * more. Note it cannot be *typed* as a positive number: constants stop at
 * 32767, so the top of memory is written `HIMEM:-16384`.
 */
export const MAX_HIMEM = RAM_TOP + 1;

/**
 * Highest line number the interpreter stores. Read at the console: `32767 END`
 * is accepted and `32768 END` answers `*** >32767 ERR`, the same limit the
 * constant parser applies to every integer in a program.
 */
export const MAX_LINE = 32767;

/** Largest integer Integer BASIC computes with; there is no floating point. */
export const MAX_INT = 32767;

/**
 * What the entry buffer holds at once, which is what limits a line.
 *
 * Integer BASIC crunches a typed line inside the monitor's 256-byte input
 * buffer at `$0200`, with the text it is still reading at one end and the
 * tokens it has produced at the other, so the ceiling is on the **sum** of the
 * two rather than on either alone. Measured at the machine across four shapes
 * that trade one against the other - a long name, a long string literal, a long
 * REM and a run of short statements - and every one of them accepts a line
 * whose typed length plus stored length is 255 and answers `*** TOO LONG ERR`
 * at 256. Typed length counts the spaces the crunch is about to throw away.
 */
export const MAX_ENTRY_BYTES = 0xff;
