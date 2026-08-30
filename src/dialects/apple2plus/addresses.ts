// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Apple II Plus addresses and figures.
 *
 * The Microsoft zero-page workspace - TXTTAB, VARTAB, ARYTAB, STREND, FRETOP,
 * MEMSIZ, CURLIN - is read off this ROM when the language layer is written, and
 * is what `src/emulator/microsoftBasicLoad.ts` takes as its pointers.
 */

/** The ROM window, `$D000`-`$FFFF`: Applesoft II and the Autostart Monitor. */
export const FIRMWARE_BYTES = 0x3000;

/** Where the tokenized program is written - the interpreter's TXTTAB. */
export const PROGRAM_BASE = 0x0801;

/**
 * Bytes free for a program and its variables on a 48K machine with no disk
 * controller. Read off the booted ROM rather than authored - this placeholder
 * exists only so the dialect has a number.
 */
export const COLD_START_BYTES_FREE = 0;
