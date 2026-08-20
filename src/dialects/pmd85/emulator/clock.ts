// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The machine's timebase, in its own file because more than the CPU keeps time
 * by it: the tape deck's bit rate is derived from the same crystal, and the
 * bus and the deck would otherwise have to import each other to agree on it.
 */

/** The MHB8080A's clock: an 18.432 MHz crystal divided by nine. */
export const CPU_HZ = 18_432_000 / 9;

/** Cycles of 8080 time per displayed frame. */
export const CYCLES_PER_FRAME = CPU_HZ / 50;
