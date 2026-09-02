import {
  buildFontSignatures,
  readFontText,
  type GlyphSignatures,
} from '../../../emulator/fontMatcher';
import type { MachineScreenText } from '../../types';
import { plainChar } from '../charset';

/**
 * Recovering the SAM's screen as characters.
 *
 * Like the Spectrum and the CPC, the SAM stores no characters anywhere: every
 * mode is a bitmap and text is drawn into it. So the screen comes back by
 * comparing each cell against the glyph the ROM would have drawn - with three
 * differences from the machines that came before it.
 *
 * The font is not in the ROM. It ships packed, and `UPACK` unpacks it into RAM
 * at boot; `CHARS` then points at it biased so glyph `c` sits at
 * `CHARS + c * 8`, the same convention the Spectrum uses. Reading the font
 * means reading RAM, and a program that redefines a glyph changes what this
 * reports - which is right: that is what is on the screen.
 *
 * A pixel is not one bit. Only modes 1 and 2 store a bitmap a byte per eight
 * pixels; mode 4 stores four bits a pixel and mode 3 two, so the mask the
 * matcher wants is rebuilt from "is this pixel the paper colour?". The paper
 * for those modes is the ROM's own `M23PAPP`, so an inverse or
 * non-default-coloured screen still reads back as text rather than as its own
 * photographic negative.
 *
 * And the text grid is not eight pixels tall. `CSIZE` starts at nine rows by
 * eight columns, so the SAM's default screen is 32x21 with a blank scanline
 * under every character - and the two-line lower window, where reports and the
 * input line live, is pushed down by the three pixels left over
 * (`LSOFF`). A reader that assumed a 24-row grid of 8x8 cells would find text
 * on none of its rows.
 */

/** Rows a glyph's bitmap occupies, whatever the cell around it. */
const GLYPH_ROWS = 8;

/** Codes the unpacked font covers: the printable ASCII range. */
const FIRST_CODE = 0x20;
const LAST_CODE = 0x7f;

/** Bytes a MODE 1/2 line occupies, and a MODE 3/4 one. */
const MODE12_BYTES_PER_LINE = 32;
const MODE34_BYTES_PER_LINE = 128;
/** Display lines the ASIC paints. */
const SCREEN_LINES = 192;

/** MODE 1's thirds/rows/scans line ordering; see display.ts. */
const MODE1_LINE_TO_BYTE = (() => {
  const table = new Uint16Array(SCREEN_LINES);
  for (let offset = 0; offset < SCREEN_LINES; offset++) {
    const line =
      (offset & 0xc0) + ((offset << 3) & 0x38) + ((offset >> 3) & 0x07);
    table[line] = offset * MODE12_BYTES_PER_LINE;
  }
  return table;
})();

/**
 * Where the ROM is currently putting characters, read off its own window
 * variables rather than assumed.
 */
export interface SamTextLayout {
  /** Columns across the screen. */
  cols: number;
  /** Text rows, upper window and lower window together. */
  rows: number;
  /** Scanlines one text row occupies - `CSIZE`'s height, nine by default. */
  cellHeight: number;
  /** First row of the lower window; rows from here down carry the offset. */
  lowerTop: number;
  /** Scanlines the lower window is pushed down by (`LSOFF`). */
  lowerOffset: number;
}

/**
 * Index the unpacked font by glyph shape.
 *
 * `charsBase` is the `CHARS` pointer as the ROM keeps it - already biased so
 * that code `c`'s bitmap is at `charsBase + c * 8`, which puts the space's own
 * glyph 256 bytes above the pointer. Reading the base as the space's address
 * reads the font a page early and turns every cell into a mismatch.
 */
export function samcoupeFontSignatures(
  readByte: (addr: number) => number,
  charsBase: number,
): GlyphSignatures {
  return buildFontSignatures({
    glyphByte: (code, row) =>
      readByte((charsBase + code * GLYPH_ROWS + row) & 0xffff),
    firstCode: FIRST_CODE,
    lastCode: LAST_CODE,
  });
}

/**
 * OCR the whole screen.
 *
 * `readScreen` reads the display page by offset from its start, not by Z80
 * address: the ASIC fetches the picture out of RAM regardless of what the CPU
 * has paged in. A cell matching no glyph reads as a space, so a screen of
 * free-hand graphics comes back blank - which is true, there is no text on it -
 * rather than as a wall of noise.
 */
export function readSamcoupeScreenText(opts: {
  signatures: GlyphSignatures;
  /** Screen mode 1-4. */
  mode: number;
  layout: SamTextLayout;
  /** The paper colour modes 3 and 4 are drawing on, from `M23PAPP`. */
  paper: number;
  readScreen: (offset: number) => number;
}): MachineScreenText {
  const { signatures, mode, layout, paper, readScreen } = opts;
  const { cols, rows } = layout;

  /** The scanline text row `row`'s glyphs start on. */
  const rowTop = (row: number): number =>
    row * layout.cellHeight + (row >= layout.lowerTop ? layout.lowerOffset : 0);

  const cellMask = (row: number, col: number): number[] =>
    Array.from({ length: GLYPH_ROWS }, (_, r) => {
      const y = rowTop(row) + r;
      if (y >= SCREEN_LINES) return 0;
      switch (mode) {
        case 1:
          return readScreen(MODE1_LINE_TO_BYTE[y]! + col);
        case 2:
          return readScreen(y * MODE12_BYTES_PER_LINE + col);
        case 3: {
          // Two bytes a cell, four 2-bit pixels each.
          let mask = 0;
          for (let b = 0; b < 2; b++) {
            const data = readScreen(y * MODE34_BYTES_PER_LINE + col * 2 + b);
            for (let p = 0; p < 4; p++) {
              if (((data >> (6 - p * 2)) & 3) !== (paper & 3))
                mask |= 0x80 >> (b * 4 + p);
            }
          }
          return mask;
        }
        default: {
          // MODE 4: four bytes a cell, two 4-bit pixels each.
          let mask = 0;
          for (let b = 0; b < 4; b++) {
            const data = readScreen(y * MODE34_BYTES_PER_LINE + col * 4 + b);
            if (data >> 4 !== paper) mask |= 0x80 >> (b * 2);
            if ((data & 0x0f) !== paper) mask |= 0x80 >> (b * 2 + 1);
          }
          return mask;
        }
      }
    });

  const lines = readFontText({
    signatures,
    cols,
    rows,
    cellMask,
    // The plain character rather than the source spelling: the seam wants one
    // code point per column, and 0x5C's spelling is the two-character escape
    // `\\` - which read back as a space, so a screen with a backslash on it
    // reported one that was not there.
    charFor: (code) => plainChar(code) ?? ' ',
  });
  return { lines, cols, rows };
}
