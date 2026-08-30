// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Apple II's clock, derived rather than declared.
 *
 * Everything on the board is counted down from one 14.31818 MHz crystal - four
 * times the NTSC colour subcarrier, which is the whole reason the machine can
 * make colour out of a bit pattern. The CPU takes that divided by 14, giving the
 * 1.023 MHz the manual quotes, and the video counters take 65 CPU cycles to a
 * scanline and 262 scanlines to a field.
 *
 * The catch, and the reason the frame rate is not 60 Hz: **one CPU cycle a line
 * is stretched**. The video and the CPU share the RAM on alternate half-cycles,
 * and to keep the 65-cycle line in step with the colour subcarrier the hardware
 * makes one cycle of every line two master clocks longer. So a line is
 * 65 x 14 + 2 = 912 master clocks, not 910, and the field rate falls out as
 * 14318180 / (912 x 262) = 59.92 Hz - the figure the machine is documented as
 * running at. Averaged over the line the CPU therefore runs at 1.0205 MHz rather
 * than 1.0227, which is why a timing loop measured on real hardware comes out
 * slightly slow against the nominal clock.
 *
 * The stretch is not modelled per-cycle: the CPU core counts plain cycles and
 * the machine's budget is the 17030 of them a field is worth, so the *average*
 * rate is right and only an instruction-by-instruction raster chase - which
 * needs a cycle-accurate video counter this machine does not have - could tell
 * the difference.
 */

/** The colour crystal everything is counted down from. */
export const MASTER_HZ = 14_318_180;

/** Master clocks to a CPU cycle. */
const MASTER_PER_CPU_CYCLE = 14;

/** CPU cycles the video counters allow a scanline. */
export const CYCLES_PER_LINE = 65;

/** Master clocks the one stretched cycle a line adds. */
const LONG_CYCLE_MASTER_CLOCKS = 2;

/** Scanlines to an NTSC field, blanking included. */
export const LINES_PER_FIELD = 262;

/** Master clocks a whole scanline takes, the stretched cycle included. */
export const MASTER_CLOCKS_PER_LINE =
  CYCLES_PER_LINE * MASTER_PER_CPU_CYCLE + LONG_CYCLE_MASTER_CLOCKS;

/** CPU cycles a field is worth, and so the budget of one frame. */
export const CYCLES_PER_FIELD = CYCLES_PER_LINE * LINES_PER_FIELD;

/** Fields a second: 59.92 Hz, not 60. */
export const FIELD_HZ = MASTER_HZ / (MASTER_CLOCKS_PER_LINE * LINES_PER_FIELD);

/** Average CPU rate over a field, which is what the stretch actually costs. */
export const CPU_HZ = CYCLES_PER_FIELD * FIELD_HZ;
