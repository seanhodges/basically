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
 * Each is verified against the booted ROM by the tests beside this file rather
 * than copied from a reference table: the commonly-quoted figures are right
 * often enough to be trusted and wrong often enough to cost a day. The program
 * and workspace pointers are pinned in `msxMachine.test.ts`, and the ones the
 * variable, report and memory readers walk in `introspection.test.ts` - where
 * each is pinned by the reading it produces agreeing with what the machine
 * itself printed, rather than by the cell holding a plausible number.
 */

/** Highest address BASIC itself uses; the top of the string space. */
export const MEMSIZ = 0xf672;
/** Top of the stack, and with it the floor of the string space. */
export const STKTOP = 0xf674;
/** Start of the program text; 0x8001 on an unexpanded 64KB machine. */
export const TXTTAB = 0xf676;
/** Bottom of the strings allocated so far; descends from {@link MEMSIZ}. */
export const FRETOP = 0xf69b;
/** Scalar variables, immediately past the program. */
export const VARTAB = 0xf6c2;
/** Arrays, past the scalars. */
export const ARYTAB = 0xf6c4;
/** End of variable storage, below the string pool. */
export const STREND = 0xf6c6;
/**
 * Default value type per initial letter, A-Z, one byte each: the value size
 * DEFINT/DEFSNG/DEFDBL/DEFSTR last set for names starting with that letter.
 * Double (8) for every letter on a clean boot, which is why an MSX program
 * writing `A=1` gets a double.
 */
export const DEFTBL = 0xf6ca;
/** The line BASIC is executing, or {@link DIRECT_MODE} at the prompt. */
export const CURLIN = 0xf41c;
/** Code of the last error, as the ERR function returns it; 0 for none. */
export const ERRFLG = 0xf414;
/** Line the last error happened on, as the ERL function returns it. */
export const ERRLIN = 0xf6b3;
/** Line the program last stopped on, and where CONT would resume from. */
export const OLDLIN = 0xf6be;
/** Program text CONT would resume at, or 0 when the program cannot resume. */
export const OLDTXT = 0xf6c0;
/** Top of the RAM BASIC will use; the string pool grows down from it. */
export const HIMEM = 0xfc4a;
/** The interrupt-driven frame counter, incremented once per display frame. */
export const JIFFY = 0xfc9e;

/** CURLIN while BASIC is at its prompt rather than running a program. */
export const DIRECT_MODE = 0xffff;

/**
 * A side-effect-free view of the machine's RAM, for the introspection readers.
 *
 * Named for `peek` rather than `read`, and deliberately: the watcher polls this
 * while the program runs, and reading through the CPU's own path would paint
 * the memory-activity overlay with accesses the program never made.
 */
export interface MsxMemPort {
  peek(addr: number): number;
  peekWord(addr: number): number;
}
