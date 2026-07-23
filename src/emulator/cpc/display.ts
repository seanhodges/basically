import type { GateArray } from './gateArray';
import type { Crtc } from './crtc';

/**
 * The CPC display renderer. All three screen modes render into one 640×400
 * canvas: the active area is 40 CRTC characters wide (2 CPU bytes each) and 200
 * scanlines tall, decoded to native pixels then scaled up to fill the canvas -
 *
 *   Mode 0  160×200, 16 colours, 2 pixels/byte → each pixel 4× wide
 *   Mode 1  320×200,  4 colours, 4 pixels/byte → each pixel 2× wide
 *   Mode 2  640×200,  2 colours, 8 pixels/byte → native width
 *
 * and every line is doubled vertically (200 → 400) for the 4:3 aspect. The
 * border is cropped, as the Sinclair machines crop theirs. Pixels are decoded
 * with the CPC's interleaved bit layout (see the per-mode helpers), looked up in
 * the Gate Array palette, and written RGBA.
 */

export const DISPLAY_WIDTH = 640;
export const DISPLAY_HEIGHT = 400;
/** Native active height; each line is doubled to fill {@link DISPLAY_HEIGHT}. */
const ACTIVE_LINES = 200;

/**
 * Decode the pen number of every pixel in one screen byte for the given mode.
 * The CPC packs a byte's pixels with an interleaved bit order, not left-to-right
 * nibbles - these are the standard formulas (CPCWiki "Standard Screen Modes").
 */
export function decodeByte(mode: number, b: number): number[] {
  switch (mode) {
    case 0: // two 4-bit pens
      return [
        ((b & 0x80) >> 7) |
          ((b & 0x08) >> 2) |
          ((b & 0x20) >> 3) |
          ((b & 0x02) << 2),
        ((b & 0x40) >> 6) |
          ((b & 0x04) >> 1) |
          ((b & 0x10) >> 2) |
          ((b & 0x01) << 3),
      ];
    case 1: // four 2-bit pens
      return [
        ((b & 0x80) >> 7) | ((b & 0x08) >> 2),
        ((b & 0x40) >> 6) | ((b & 0x04) >> 1),
        ((b & 0x20) >> 5) | ((b & 0x02) >> 0),
        ((b & 0x10) >> 4) | ((b & 0x01) << 1),
      ];
    default: // mode 2: eight 1-bit pens, MSB leftmost
      return [
        (b >> 7) & 1,
        (b >> 6) & 1,
        (b >> 5) & 1,
        (b >> 4) & 1,
        (b >> 3) & 1,
        (b >> 2) & 1,
        (b >> 1) & 1,
        b & 1,
      ];
  }
}

/** Native pixels a single screen byte expands to in each mode. */
export function pixelsPerByte(mode: number): number {
  return mode === 0 ? 2 : mode === 1 ? 4 : 8;
}

/** A source of screen bytes (the machine's RAM, read raw - never the ROM). */
export interface ScreenReader {
  read(addr: number): number;
}

/**
 * Render the whole active display into `frameBuffer` (RGBA, DISPLAY_WIDTH ×
 * DISPLAY_HEIGHT). Reads screen bytes through `mem`, decodes pens per the Gate
 * Array's current mode, and colours them through its palette.
 */
export function renderDisplay(
  mem: ScreenReader,
  gateArray: GateArray,
  crtc: Crtc,
  frameBuffer: Uint8ClampedArray,
): void {
  const cols = crtc.displayedChars;
  const rows = crtc.displayedRows;
  const rpr = crtc.rastersPerRow;
  const mode = gateArray.mode;
  const ppb = pixelsPerByte(mode);
  const nativeW = cols * 2 * ppb; // 160 / 320 / 640 for the standard 40-col screen
  const xScale =
    nativeW > 0 ? Math.max(1, Math.floor(DISPLAY_WIDTH / nativeW)) : 1;

  // Pre-flatten the 16 pen colours to RGBA for the inner loop.
  const penRgba = new Array<[number, number, number]>(16);
  for (let p = 0; p < 16; p++)
    penRgba[p] = [...gateArray.penRgb(p)] as [number, number, number];

  for (let cy = 0; cy < rows; cy++) {
    for (let r = 0; r < rpr; r++) {
      const y = cy * rpr + r;
      if (y >= ACTIVE_LINES) break;
      let nativeX = 0;
      for (let cx = 0; cx < cols; cx++) {
        const addr = crtc.byteAddress(cy, r, cx);
        for (let part = 0; part < 2; part++) {
          const pens = decodeByte(mode, mem.read((addr + part) & 0xffff));
          for (let i = 0; i < pens.length; i++) {
            const [rr, gg, bb] = penRgba[pens[i]! & 0x0f]!;
            paintPixel(frameBuffer, nativeX, y, xScale, rr, gg, bb);
            nativeX++;
          }
        }
      }
      // If the mode's native line is narrower than the canvas, leave the tail
      // black (border-cropped screens never under-fill in the standard modes).
    }
  }
}

/** Paint one native pixel: `xScale` wide and doubled to two canvas rows. */
function paintPixel(
  fb: Uint8ClampedArray,
  nativeX: number,
  y: number,
  xScale: number,
  r: number,
  g: number,
  b: number,
): void {
  const x0 = nativeX * xScale;
  for (let dy = 0; dy < 2; dy++) {
    const py = y * 2 + dy;
    let idx = (py * DISPLAY_WIDTH + x0) * 4;
    for (let dx = 0; dx < xScale && x0 + dx < DISPLAY_WIDTH; dx++) {
      fb[idx] = r;
      fb[idx + 1] = g;
      fb[idx + 2] = b;
      fb[idx + 3] = 255;
      idx += 4;
    }
  }
}
