// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Where everything lives on an Apple I, and what each number was read from.
 *
 * Every value below was read back off the running machine: the firmware in
 * `public/roms/apple1/apple1.rom` was booted on the vendored 6502 core, driven through
 * the monitor into Integer BASIC, fed program lines through the keyboard PIA and
 * then dumped - so the pointers, the entry points and the line format are what
 * the interpreter itself does, not what a manual says it does.
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

/**
 * Integer BASIC's entry points, typed at the monitor as `E000R` / `E2B3R`.
 * `$E000` is a `JMP $E2B0` into the cold start; the warm start is the
 * instruction after it, which is why the two differ by three bytes.
 */
export const BASIC_COLD_ENTRY = 0xe000;
export const BASIC_WARM_ENTRY = 0xe2b3;

/**
 * The head of the interpreter's command loop, and the one address every way of
 * finishing with a program arrives at.
 *
 * The warm start is `JSR $E3CD` (print a carriage return) and falls straight
 * into it; the three instructions here are `LSR $D9` (drop the flag that says a
 * program is running), `LDA #$BE` and `JSR $E3C9`, which is the `>` prompt
 * being printed. Falling off the end, `END`, a break from the keyboard and every
 * `*** ... ERR` report all reach it, whereas the warm start itself is reached by
 * only some of them - which is why this is the address the emulator watches to
 * know a run is over.
 */
export const BASIC_COMMAND_LOOP = 0xe2b6;

/** 6821 PIA: keyboard data/control, display data/control. */
export const KBD = 0xd010;
export const KBDCR = 0xd011;
export const DSP = 0xd012;
export const DSPCR = 0xd013;

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
/** Pointer to the line being executed; the source of `currentLine()`. */
export const PLINE = 0x00dc;

/** Stock LOMEM/HIMEM, and the program-plus-variables space they leave. */
export const DEFAULT_LOMEM = 0x0800;
export const DEFAULT_HIMEM = 0x1000;
export const COLD_START_BYTES_FREE = DEFAULT_HIMEM - DEFAULT_LOMEM;

/**
 * Lowest address a program may move LOMEM to.
 *
 * The monitor assembles a typed line at `$0200-$027F` and Integer BASIC crunches
 * it there, so a workspace reaching into that page is overwritten by the next
 * thing typed - including the `RUN` that starts the program. `$0280` is the
 * first byte above it, and the bottom of the free RAM the memory map names.
 */
export const MIN_LOMEM = 0x0280;

/**
 * One past the highest address HIMEM may be set to. HIMEM is an exclusive top,
 * and `$0FFF` is the last byte of the fitted RAM, so a program may claim the
 * whole of it and no more.
 */
export const MAX_HIMEM = RAM_TOP + 1;

/**
 * The zero-page housekeeping block the cassette interface dumps, `4A.FF W` at
 * the monitor. It carries LOMEM, HIMEM, PP and PV, so a tape that holds it plus
 * the program area is a complete BASIC workspace.
 */
export const ZP_BLOCK_BASE = 0x004a;
export const ZP_BLOCK_TOP = 0x00ff;
export const ZP_BLOCK_BYTES = ZP_BLOCK_TOP - ZP_BLOCK_BASE + 1;

/**
 * Highest line number the interpreter stores. Read at the console: `32767 END`
 * is accepted and `32768 END` answers `*** >32767 ERR`, which is the same limit
 * the constant parser applies to every integer in a program.
 */
export const MAX_LINE = 32767;

/** Largest integer Integer BASIC computes with; there is no floating point. */
export const MAX_INT = 32767;

/**
 * Longest line the interpreter will store, counting its own length byte.
 *
 * The entry buffer at `$0200` holds the typed text and then the tokens that are
 * crunched out of it, and the token cursor is a single byte, so an over-long
 * line answers `*** TOO LONG ERR` rather than wrapping. 255 is the ceiling the
 * length byte itself imposes and is the one worth enforcing.
 */
export const MAX_LINE_BYTES = 0xff;
