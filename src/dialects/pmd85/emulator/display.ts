// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/** Displayed pixels across, and scanlines down. */
export const DISPLAY_WIDTH = 288;
export const DISPLAY_HEIGHT = 256;

/** Base of video RAM, and the stride between one scanline and the next. */
export const VIDEO_RAM_BASE = 0xc000;
export const VIDEO_RAM_STRIDE = 0x40;

/**
 * Bytes of each scanline that reach the screen, and pixels packed into each.
 *
 * The stride is 64 bytes but only 48 are displayed, and only the low six bits
 * of each byte are pixels: 48 x 6 = 288. The top two bits carry the four-level
 * attribute (black, white, grey, blink) for that six-pixel cell. Assuming eight
 * pixels to the byte, or a 48-byte stride, yields a screen that looks plausible
 * and is wrong.
 */
export const DISPLAYED_BYTES_PER_LINE = 48;
export const PIXELS_PER_BYTE = 6;

export class Pmd85Display {
  renderTo(_ctx: CanvasRenderingContext2D, _videoRam: Uint8Array): void {
    throw new Error('pmd85: not implemented');
  }
}
