// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Altair's "display" (Stage 2) - which is not a display at all.
 *
 * Every other machine in this project renders video RAM: the CPU pokes bytes
 * into a screen buffer and a renderer draws them. The Altair has no video
 * hardware whatsoever. BASIC writes characters to a serial port, and a terminal
 * on the other end of the wire scrolls them up a screen (or hammers them onto
 * paper, on the ASR-33 the machine actually shipped alongside).
 *
 * So this module models the *terminal*, not the machine: an 80x24 grid of
 * characters with a cursor, fed one byte at a time by {@link Altair8800Serial}
 * from OUTs to the 2SIO data port, handling the handful of control codes a
 * teletype honours - CR, LF, backspace, bell - and scrolling when the cursor
 * runs off the bottom. `renderTo` then draws that grid, exactly as the TRS-80's
 * `display.ts` draws its 1K of video RAM.
 *
 * 80x24 is the glass-terminal configuration, chosen over the ASR-33's 72-column
 * paper roll because a fixed canvas suits a screen better than a scroll. Leave
 * BASIC's own TERMINAL WIDTH at its 72-column default so `PRINT`'s comma zones
 * land where the manual says they do.
 */

/** Terminal grid: 80 columns by 24 rows. */
export const COLS = 80;
export const ROWS = 24;

/** Character cell in pixels; 8x16 gives the 640x384 canvas the dialect declares. */
export const CELL_WIDTH = 8;
export const CELL_HEIGHT = 16;

export const DISPLAY_WIDTH = COLS * CELL_WIDTH;
export const DISPLAY_HEIGHT = ROWS * CELL_HEIGHT;

/**
 * The 80x24 character grid, as the terminal sees it. Stage 2 fills this in:
 * `write` consumes one byte from the serial port, the buffer scrolls on
 * overflow, and `renderTo` paints it.
 */
export class Altair8800Terminal {
  /** One byte per cell, ASCII, row-major. */
  readonly cells = new Uint8Array(COLS * ROWS);

  /** Clear the screen and home the cursor. */
  clear(): void {
    throw new Error('altair8800: not implemented');
  }

  /** Consume one output byte from the serial port. */
  write(_byte: number): void {
    throw new Error('altair8800: not implemented');
  }

  /** Paint the grid onto the emulator canvas. */
  renderTo(_ctx: CanvasRenderingContext2D): void {
    throw new Error('altair8800: not implemented');
  }
}
