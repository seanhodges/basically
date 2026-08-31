// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Applesoft's addresses and figures, read off `public/roms/apple2plus.rom`
 * booted on the shared Apple II emulator rather than taken from a manual.
 *
 * Only what the interpreter decides lives here. The board is the sibling's -
 * the same 48K, the same I/O page, the same display bases and the same raster -
 * so `../apple2/addresses.ts` is imported where those are wanted and nothing
 * about them is restated in this file.
 */

/** The ROM window, `$D000`-`$FFFF`: Applesoft II and the Autostart Monitor. */
export const FIRMWARE_BYTES = 0x3000;

/**
 * The two halves of the window. Applesoft is one contiguous 10K block across
 * five sockets, so unlike the sibling there is no Programmer's Aid and no empty
 * socket to name.
 */
export const BASIC_BASE = 0xd000;
export const BASIC_TOP = 0xf7ff;
export const MONITOR_BASE = 0xf800;

/**
 * The interpreter's cold start. Typed at the monitor as `E000G` on a machine
 * that lands there - which this one does not: the Autostart Monitor runs the
 * cold start itself out of reset, so a II Plus arrives at {@link BASIC_PROMPT}
 * having been asked nothing.
 */
export const BASIC_COLD_ENTRY = 0xe000;

/** The prompt that says Applesoft is up. */
export const BASIC_PROMPT = ']';

/**
 * The keyword table: ASCII with bit 7 set on each keyword's last character,
 * one entry per token from `$80`, closed by a `$00`. `keywords.ts` is walked
 * out of this address and `keywords.test.ts` re-walks it on every run.
 */
export const TOKEN_TABLE = 0xd0d0;

// --------------------------------------------------------------------------
// The zero-page workspace
// --------------------------------------------------------------------------
//
// The standard Microsoft 6502 BASIC set, in the places this ROM keeps them.
// `src/emulator/microsoftBasicLoad.ts` takes the first of these as its
// `programBase` and the rest as the `pointers` an injected image has to agree
// with.

/** Start of the tokenized program. */
export const TXTTAB = 0x0067;
/** End of the program, and start of the scalar variables. */
export const VARTAB = 0x0069;
/** End of the scalars, and start of the arrays. */
export const ARYTAB = 0x006b;
/** End of the arrays: everything above this is free or string space. */
export const STREND = 0x006d;
/** Bottom of the string space, which fills downwards from {@link MEMSIZ}. */
export const FRETOP = 0x006f;
/** Top of the memory Applesoft will use. */
export const MEMSIZ = 0x0073;
/** The line number being executed. */
export const CURLIN = 0x0075;

/**
 * Where the program starts, and where it always starts: unlike the sibling's
 * interpreter, which grows its program down from whatever `HIMEM:` it is given,
 * Applesoft grows up from this fixed base. That is why a program here does not
 * have to carry the workspace it was written under.
 */
export const PROGRAM_BASE = 0x0801;

/**
 * The high byte {@link CURLIN} holds in direct mode, read off the machine at
 * its prompt (`CURLIN` = `$FF00` there). A line number never reaches `$FF00`,
 * so the high byte alone answers "is a program running".
 */
export const DIRECT_MODE_MARK = 0xff;

/** {@link MEMSIZ} as the cold start lays it down on an unexpanded 48K machine. */
export const DEFAULT_MEMSIZ = 0xc000;

/**
 * Bytes a program and its variables have between them, stock.
 *
 * `PRINT FRE(0)` at the prompt answers two less than this - it measures from
 * `STREND`, and an empty program has already spent two bytes on its zero link.
 */
export const COLD_START_BYTES_FREE = DEFAULT_MEMSIZ - PROGRAM_BASE;

/**
 * The highest line number the interpreter accepts. `64000 END` answers
 * `?SYNTAX ERROR` at the prompt; `63999 END` stores.
 *
 * Not the sibling's 32767 - that is Integer BASIC's, and it is the limit of a
 * signed integer rather than of a line field. Both machines store the number in
 * the same two bytes.
 */
export const MAX_LINE = 63999;

/**
 * Characters the input buffer keeps from a typed line, measured by typing
 * increasing lengths at the prompt and reading the stored line back: at 239 the
 * whole line stores, and everything typed past it is dropped on the floor.
 */
export const MAX_ENTRY_BYTES = 239;
