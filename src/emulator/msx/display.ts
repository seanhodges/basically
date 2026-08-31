// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Canvas geometry for the TMS9918A-family VDP: the 256x192 active window plus
 * the border the chip draws around it. Both figures are provisional until the
 * renderer measures the real active window off the PAL part.
 */
export const DISPLAY_WIDTH = 320;
export const DISPLAY_HEIGHT = 240;

/** Not implemented yet. */
export function renderFrame(
  _vram: Uint8Array,
  _registers: Uint8Array,
  _out: Uint8ClampedArray,
): void {
  throw new Error('msx: display not implemented');
}
