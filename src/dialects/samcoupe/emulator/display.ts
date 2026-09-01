import { CLUT_ENTRIES, paletteRgb, SCREEN_LINES, type SamAsic } from './asic';

/**
 * One raster for all four screen modes.
 *
 * MODE 3 is the widest at 512x192 and every other mode fits inside it at two
 * device pixels per pixel, so the buffer is always 512x192 and the 256-wide
 * modes double across. A character cell is sixteen device pixels wide in every
 * mode, which is what makes one loop serve all four.
 *
 *   MODE 1  Spectrum layout: 6144 bitmap bytes in the famous thirds/rows/scans
 *           order, then 768 attributes, one per 8x8 cell.
 *   MODE 2  the same 6144 bitmap bytes but line-linear, with 6144 attributes at
 *           offset 0x2000 - one per cell *per pixel row*, so colour changes
 *           every scanline instead of every eight.
 *   MODE 3  24K, 128 bytes a line, four 2-bit pixels per byte, MSB pair first.
 *   MODE 4  24K, 128 bytes a line, two 4-bit pixels per byte, high nibble first.
 *
 * Ink and paper in modes 1 and 2 are CLUT indices, not fixed colours: the
 * attribute's three ink bits plus bit 6 make a four-bit index, and the same for
 * paper with bits 3-5. So the Spectrum-compatible modes still get the SAM's
 * palette, and BRIGHT is simply the CLUT's top eight entries.
 *
 * Mode 3's four colours come from four CLUT entries chosen by HMPR bits 5-6,
 * and with the middle two swapped - pixel value 1 reads CLUT entry 2 and value
 * 2 reads entry 1. That is the hardware's own ordering (the two bits of a
 * mode-3 pixel come off different byte-planes), not a transcription slip.
 */

export const DISPLAY_WIDTH = 512;
export const DISPLAY_HEIGHT = SCREEN_LINES;

/** Bytes a MODE 3/4 line occupies; a cell is four of them. */
const MODE34_BYTES_PER_LINE = 128;
/** Bytes a MODE 1/2 bitmap line occupies. */
const MODE12_BYTES_PER_LINE = 32;
/** Where MODE 2's attribute half starts. */
const MODE2_ATTR_OFFSET = 0x2000;
/** Size of MODE 1's bitmap half, and so where its attributes start. */
const MODE1_ATTR_OFFSET = 6144;
/** Character cells across the picture. */
const SCREEN_CELLS = 32;

/**
 * MODE 1 line -> byte offset. The display file is ordered by thirds of the
 * screen, then by character row within a third, then by pixel row within a
 * character - so consecutive scanlines are 2048 bytes apart, not 32.
 */
const MODE1_LINE_TO_BYTE = (() => {
  const table = new Uint16Array(SCREEN_LINES);
  for (let offset = 0; offset < SCREEN_LINES; offset++) {
    const line =
      (offset & 0xc0) + ((offset << 3) & 0x38) + ((offset >> 3) & 0x07);
    table[line] = offset * MODE12_BYTES_PER_LINE;
  }
  return table;
})();

/** MODE 1/2 attribute -> CLUT index for ink and paper; bit 6 is the BRIGHT half. */
function attrInk(attr: number): number {
  return ((attr >> 3) & 8) | (attr & 7);
}
function attrPaper(attr: number): number {
  return (attr >> 3) & 0x0f;
}

/** The four CLUT entries MODE 3 draws with, in the hardware's own order. */
export function mode3Clut(asic: SamAsic, hmpr: number): number[] {
  const base = (hmpr & 0x60) >> 3;
  return [
    asic.clut[base | 0]!,
    asic.clut[base | 2]!,
    asic.clut[base | 1]!,
    asic.clut[base | 3]!,
  ];
}

/**
 * Paint the current screen into an RGBA buffer.
 *
 * `screen` is the 32K the display page and the one above it hold, read straight
 * out of RAM rather than through the Z80's window - the picture is fetched by
 * the ASIC, which does not care what the CPU has paged in.
 */
export function renderScreen(
  asic: SamAsic,
  hmpr: number,
  screen: (offset: number) => number,
  out: Uint8ClampedArray,
): void {
  if (asic.screenOff) {
    // Bit 7 of the border port blanks modes 3 and 4 to black, buying the CPU
    // the cycles the ASIC would have spent fetching.
    for (let i = 0; i < out.length; i += 4) {
      out[i] = out[i + 1] = out[i + 2] = 0;
      out[i + 3] = 255;
    }
    return;
  }

  const rgb: [number, number, number][] = [];
  for (let i = 0; i < CLUT_ENTRIES; i++) rgb.push(paletteRgb(asic.clut[i]!));
  const mode = asic.mode;
  const m3 = mode === 3 ? mode3Clut(asic, hmpr).map(paletteRgb) : rgb;

  for (let line = 0; line < DISPLAY_HEIGHT; line++) {
    let px = line * DISPLAY_WIDTH;
    for (let cell = 0; cell < SCREEN_CELLS; cell++) {
      if (mode === 3 || mode === 4) {
        const base = line * MODE34_BYTES_PER_LINE + cell * 4;
        for (let b = 0; b < 4; b++) {
          const data = screen(base + b);
          if (mode === 3) {
            put(out, px, m3[data >> 6]!);
            put(out, px + 1, m3[(data >> 4) & 3]!);
            put(out, px + 2, m3[(data >> 2) & 3]!);
            put(out, px + 3, m3[data & 3]!);
            px += 4;
          } else {
            const left = rgb[data >> 4]!;
            const right = rgb[data & 0x0f]!;
            put(out, px, left);
            put(out, px + 1, left);
            put(out, px + 2, right);
            put(out, px + 3, right);
            px += 4;
          }
        }
        continue;
      }

      let data: number;
      let attr: number;
      if (mode === 1) {
        data = screen(MODE1_LINE_TO_BYTE[line]! + cell);
        attr = screen(
          MODE1_ATTR_OFFSET + (line >> 3) * MODE12_BYTES_PER_LINE + cell,
        );
      } else {
        const offset = line * MODE12_BYTES_PER_LINE + cell;
        data = screen(offset);
        attr = screen(MODE2_ATTR_OFFSET + offset);
      }
      let ink = attrInk(attr);
      let paper = attrPaper(attr);
      if (asic.flashPhase && attr & 0x80) [ink, paper] = [paper, ink];
      const inkRgb = rgb[ink]!;
      const paperRgb = rgb[paper]!;
      for (let bit = 7; bit >= 0; bit--) {
        const colour = data & (1 << bit) ? inkRgb : paperRgb;
        put(out, px, colour);
        put(out, px + 1, colour);
        px += 2;
      }
    }
  }
}

function put(out: Uint8ClampedArray, pixel: number, rgb: number[]): void {
  const i = pixel * 4;
  out[i] = rgb[0]!;
  out[i + 1] = rgb[1]!;
  out[i + 2] = rgb[2]!;
  out[i + 3] = 255;
}
