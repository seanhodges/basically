// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Where everything lives on an Apple I, and what each number was read from.
 *
 * Each value comes from the Apple-1 Operation Manual, the Apple-1 BASIC Users
 * Manual or the supplied firmware image itself, and is pinned by a test that
 * reads it back off the running machine - an address nobody has read off the
 * hardware is a guess, and a guess here is invisible until a program misbehaves.
 */

/** Low RAM fitted on the board. */
export const RAM_BASE = 0x0000;
export const RAM_TOP = 0x0fff;

/** The jumpered block Integer BASIC is loaded into. */
export const BASIC_BASE = 0xe000;
export const BASIC_TOP = 0xefff;

/** The monitor PROM. */
export const MONITOR_BASE = 0xff00;

/**
 * The one supplied firmware file: WozMon first, then Integer BASIC. WozMon
 * leads so an image carrying only the monitor pads into a machine that boots to
 * the monitor with no interpreter fitted, which is a real Apple I with no BASIC
 * tape loaded rather than a broken one.
 */
export const MONITOR_BYTES = 0x0100;
export const BASIC_BYTES = 0x1000;
export const FIRMWARE_BYTES = MONITOR_BYTES + BASIC_BYTES;

/** 6821 PIA: keyboard data/control, display data/control. */
export const KBD = 0xd010;
export const KBDCR = 0xd011;
export const DSP = 0xd012;
export const DSPCR = 0xd013;

/** Zero-page pointers Integer BASIC keeps its workspace bounds in. */
export const LOMEM = 0x004a;
export const HIMEM = 0x004c;

/** Stock LOMEM/HIMEM, and the program-plus-variables space they leave. */
export const DEFAULT_LOMEM = 0x0800;
export const DEFAULT_HIMEM = 0x1000;
export const COLD_START_BYTES_FREE = DEFAULT_HIMEM - DEFAULT_LOMEM;
