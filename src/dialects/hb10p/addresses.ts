// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * MSX BASIC workspace addresses, in the system variable area the standard
 * places at 0xF380-0xFFFF.
 *
 * Every value here is read off the machine's own ROM rather than copied from a
 * reference, because the widely-quoted figures are right often enough to be
 * trusted and wrong often enough to cost a day.
 */

/** Not implemented yet: the interpreter's program-start pointer (TXTTAB). */
export const TXTTAB = 0;
/** Not implemented yet: scalar variables (VARTAB). */
export const VARTAB = 0;
/** Not implemented yet: arrays (ARYTAB). */
export const ARYTAB = 0;
/** Not implemented yet: end of variable storage (STREND). */
export const STREND = 0;
/** Not implemented yet: top of usable RAM (HIMEM). */
export const HIMEM = 0;
/** Not implemented yet: the line BASIC is executing (CURLIN). */
export const CURLIN = 0;
