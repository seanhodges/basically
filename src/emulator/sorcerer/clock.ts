// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The machine's timebase, in its own file because more than the CPU keeps time
 * by it: the video circuit and the CPU are divisions of the same crystal, and
 * the cassette's bit rates come off it too.
 *
 * Everything here follows from one number. The Sorcerer runs a 12.638 MHz
 * crystal as its dot clock; the CPU takes it divided by six, and the display is
 * 806 dot times across by 261 lines down - of which 512 by 240 reach the
 * screen. So the frame rate is not chosen, it is what those three figures
 * leave: a little over 60 Hz, and not the round 50 a European reader expects.
 */

/** The dot clock: one pixel of the 512-across display per tick. */
export const DOT_CLOCK_HZ = 12_638_000;

/** The Z80's clock, the dot clock divided by six. */
export const CPU_HZ = DOT_CLOCK_HZ / 6;

/** Dot times in one scan line, including the blanking either side of it. */
export const DOTS_PER_LINE = 806;

/** Scan lines in one frame, including the vertical blanking below it. */
export const LINES_PER_FRAME = 261;

/** Dot times in a whole frame. */
export const DOTS_PER_FRAME = DOTS_PER_LINE * LINES_PER_FRAME;

/** Cycles of Z80 time per displayed frame. */
export const CYCLES_PER_FRAME = DOTS_PER_FRAME / 6;

/**
 * How far into the frame vertical blanking starts, in CPU cycles.
 *
 * The VSYNC bit the Monitor polls is high for the lines below the visible 240,
 * so a machine reporting it needs to know where in its own frame it is. Derived
 * from the same three numbers rather than approximated as a fraction.
 */
export const VBLANK_START_CYCLES = (240 * DOTS_PER_LINE) / 6;
