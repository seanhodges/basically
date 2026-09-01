// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The DTSS terminal was a Teletype Model 33 ASR printing on a paper roll, so
 * there is no screen memory and nothing can be redrawn once printed. Like the
 * Altair's terminal, the roll is modelled as a fixed window painted into a
 * canvas, because a canvas suits a screen better than a scroll.
 *
 * 72 columns is the Model 33's own line; the row count is the size of the
 * window kept on screen, not a property of the machine.
 */
export const COLS = 72;
export const ROWS = 24;

/** Cell metrics for the rendered window. */
export const CELL_WIDTH = 8;
export const CELL_HEIGHT = 16;

export const DISPLAY_WIDTH = COLS * CELL_WIDTH;
export const DISPLAY_HEIGHT = ROWS * CELL_HEIGHT;
