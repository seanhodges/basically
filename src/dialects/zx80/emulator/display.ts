import { NEWLINE } from '../charset';
import type { Zx80Memory } from './memory';

export const DISPLAY_WIDTH = 256; // 32 columns x 8 px
export const DISPLAY_HEIGHT = 192; // 24 rows x 8 px
/** ZX80 character bitmaps live at 0x0E00 in the 4K ROM (cf. 0x1E00 on ZX81). */
const CHARSET_ROM_OFFSET = 0x0e00;

/**
 * Render the ZX80 display file into an RGBA pixel buffer (256x192).
 *
 * Like the ZX81 the D_FILE is a sequence of NEWLINE-terminated rows, and the
 * glyph bitmaps come from the 4K ROM at 0x0E00. Unlike the ZX81 the ZX80
 * D_FILE has no leading NEWLINE — it points straight at the first of up to 24
 * rows. This is a frame snapshot, faithful for BASIC programs without
 * cycle-exact video.
 *
 * The ZX80 display file is *collapsed*: a blank row is a single NEWLINE rather
 * than 32 spaces + NEWLINE, and the file ends at DF_END (`dfEnd`) — usually far
 * short of a full 24×33 buffer. We must stop at that end: reading on would
 * spill the program/edit/variables area that lives just above the display file
 * onto the screen as garbage (the source-listing "overrun" symptom).
 */
export function renderDisplay(
  memory: Zx80Memory,
  dfile: number,
  dfEnd: number,
  pixels: Uint8ClampedArray,
): void {
  pixels.fill(0xff); // white background (and alpha)

  if (dfile < 0x4000 || dfile > 0xffff) return;

  // Bound rendering at DF_END when it looks sane; otherwise fall back to the
  // 24-row cap alone (e.g. before the ROM has set the pointer up at boot).
  const end = dfEnd > dfile && dfEnd <= 0x10000 ? dfEnd : 0x10000;

  let addr = dfile;

  for (let row = 0; row < 24 && addr < end; row++) {
    let col = 0;
    while (addr < end) {
      const c = memory.read(addr);
      addr++;
      if (c === NEWLINE) break;
      if (col >= 32) break;
      drawGlyph(memory, pixels, row, col, c);
      col++;
    }
  }
}

function drawGlyph(
  memory: Zx80Memory,
  pixels: Uint8ClampedArray,
  row: number,
  col: number,
  code: number,
): void {
  const glyph = code & 0x3f;
  const inverse = (code & 0x80) !== 0;
  const glyphBase = CHARSET_ROM_OFFSET + glyph * 8;
  const x0 = col * 8;
  const y0 = row * 8;

  for (let y = 0; y < 8; y++) {
    let bits = memory.rom[glyphBase + y]!;
    if (inverse) bits = ~bits & 0xff;
    const rowOffset = ((y0 + y) * DISPLAY_WIDTH + x0) * 4;
    for (let x = 0; x < 8; x++) {
      if (bits & (0x80 >> x)) {
        const p = rowOffset + x * 4;
        pixels[p] = 0x10;
        pixels[p + 1] = 0x10;
        pixels[p + 2] = 0x10;
        // alpha already 0xff
      }
    }
  }
}
