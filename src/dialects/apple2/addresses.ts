// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Apple II addresses and figures.
 *
 * Only the two the dialect's shape depends on are here so far; the zero-page
 * workspace, the display bases and the soft switches are read off the ROM and
 * the monitor when the language and emulator layers are written.
 */

/**
 * The ROM window, `$D000`-`$FFFF`: Programmer's Aid #1 (or `$FF` fill),
 * Integer BASIC at `$E000`-`$F7FF`, and the Monitor at `$F800`-`$FFFF`.
 */
export const FIRMWARE_BYTES = 0x3000;

/** The hi-res raster the text and lo-res pages are also drawn into. */
export const DISPLAY_WIDTH = 280;
export const DISPLAY_HEIGHT = 192;

/**
 * Bytes a program and its variables share, which on this machine is the whole
 * workspace between `LOMEM:` and `HIMEM:`. Measured off the booted ROM rather
 * than authored - this placeholder exists only so the dialect has a number.
 */
export const COLD_START_BYTES_FREE = 0;
