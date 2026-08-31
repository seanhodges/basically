/**
 * One raster for all four screen modes. MODE 3 is the widest at 512x192, and
 * the 256-wide modes draw two device pixels per pixel into the same buffer.
 */

export const DISPLAY_WIDTH = 512;
export const DISPLAY_HEIGHT = 192;

/** Paint the current screen mode into an RGBA buffer. */
export function renderScreen(_ram: Uint8Array, _out: Uint8ClampedArray): void {
  throw new Error('samcoupe: not implemented');
}
