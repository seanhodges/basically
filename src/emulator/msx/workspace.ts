// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Where MSX BASIC keeps the pointers this machine reads, in the system variable
 * area the MSX standard fixes at 0xF380-0xFFFF.
 *
 * The area is part of the standard rather than of one machine, so every MSX1
 * and MSX2 answers at the same addresses whatever its BIOS - which is why these
 * live beside the machine rather than in a dialect folder.
 *
 * Each is verified against the booted ROM by `msxMachine.test.ts` rather than
 * copied from a reference table: the commonly-quoted figures are right often
 * enough to be trusted and wrong often enough to cost a day.
 */

/** Start of the program text; 0x8001 on an unexpanded 64KB machine. */
export const TXTTAB = 0xf676;
/** Scalar variables, immediately past the program. */
export const VARTAB = 0xf6c2;
/** Arrays, past the scalars. */
export const ARYTAB = 0xf6c4;
/** End of variable storage, below the string pool. */
export const STREND = 0xf6c6;
/** The line BASIC is executing, or {@link DIRECT_MODE} at the prompt. */
export const CURLIN = 0xf41c;
/** Top of the RAM BASIC will use; the string pool grows down from it. */
export const HIMEM = 0xfc4a;
/** The interrupt-driven frame counter, incremented once per display frame. */
export const JIFFY = 0xfc9e;

/** CURLIN while BASIC is at its prompt rather than running a program. */
export const DIRECT_MODE = 0xffff;
