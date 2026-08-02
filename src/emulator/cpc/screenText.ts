import {
  buildFontSignatures,
  readFontText,
  type GlyphSignatures,
} from '../fontMatcher';
import { decodeByte, pixelsPerByte } from './display';
import { plainChar } from '../../dialects/cpc464/charset';
import type { Crtc } from './crtc';
import type { MachineScreenText } from '../../dialects/types';

/**
 * Recovering a CPC screen as characters.
 *
 * The CPC keeps no characters anywhere either - the firmware draws its text
 * straight into the bitmap - so the screen comes back the same way the
 * Spectrum's does: compare each 8x8 cell against the glyph the ROM would have
 * drawn. Two things differ, and both are the caller's side of the shared
 * matcher. A CPC screen byte holds two, four or eight pixels depending on the
 * MODE, so a character is four, two or one byte wide; and the CRTC decides
 * where the screen sits and how big it is, so nothing here is a constant.
 *
 * Shared by the 464 and the 6128, which draw from the same firmware font.
 */

/**
 * The firmware character matrices, confirmed against the real `cpc464.rom`:
 * the last 2K of the lower (OS) ROM is 256 glyphs of eight bytes, glyph `c` at
 * `0x3800 + c * 8`, bit 7 the leftmost pixel. The table runs to the end of the
 * bank, so every code has a shape - unlike the Spectrum's, which starts at the
 * space.
 */
const FONT_BASE = 0x3800;
const FIRST_CODE = 0x20;
const LAST_CODE = 0xff;

/** Scanlines an 8x8 glyph occupies; a CRTC programmed otherwise isn't text. */
const GLYPH_ROWS = 8;
/** Native pixels across one character cell, in every mode. */
const GLYPH_PIXELS = 8;
/** CPU bytes the CRTC fetches per character cell. */
const BYTES_PER_CRTC_CELL = 2;

/** Index the firmware font by glyph shape, once per machine. */
export function cpcFontSignatures(lowerRom: Uint8Array): GlyphSignatures {
  return buildFontSignatures({
    glyphByte: (code, row) =>
      lowerRom[FONT_BASE + code * GLYPH_ROWS + row] ?? 0,
    firstCode: FIRST_CODE,
    lastCode: LAST_CODE,
  });
}

/**
 * Text columns the current MODE gives, from the CRTC's own displayed width.
 *
 * A character is always eight native pixels wide, and a mode-0 byte carries
 * two of them where a mode-2 byte carries eight - which is exactly why the
 * firmware reports 20, 40 and 80 columns for the three modes off the same
 * 40-cell CRTC line.
 */
function textCols(crtc: Crtc, mode: number): number {
  const bytesPerChar = GLYPH_PIXELS / pixelsPerByte(mode);
  return Math.floor((crtc.displayedChars * BYTES_PER_CRTC_CELL) / bytesPerChar);
}

/**
 * OCR the whole screen, or null when the CRTC is not showing a text grid.
 *
 * `readScreenByte` is the machine's own RAM read (never the ROM overlay - the
 * screen is RAM whatever is paged in). A cell matching no glyph reads as a
 * space, so a screen of drawn graphics comes back blank rather than as noise,
 * and so does one whose glyphs a `SYMBOL` has redefined.
 */
export function readCpcScreenText(opts: {
  signatures: GlyphSignatures;
  crtc: Crtc;
  mode: number;
  readScreenByte: (addr: number) => number;
}): MachineScreenText | null {
  const { signatures, crtc, mode, readScreenByte } = opts;
  const rows = crtc.displayedRows;
  const cols = textCols(crtc, mode);
  // Mid-reset, or a program driving the CRTC for a split screen or a taller
  // character row: there is no 8-pixel grid to read, so say so rather than
  // report a mis-sliced screen.
  if (rows < 1 || cols < 1 || crtc.rastersPerRow !== GLYPH_ROWS) return null;

  const bytesPerChar = GLYPH_PIXELS / pixelsPerByte(mode);
  const lines = readFontText({
    signatures,
    cols,
    rows,
    charFor: (code) => plainChar(code) ?? ' ',
    cellMask: (row, col) =>
      Array.from({ length: GLYPH_ROWS }, (_, raster) => {
        let mask = 0;
        for (let byte = 0; byte < bytesPerChar; byte++) {
          const index = col * bytesPerChar + byte;
          const addr =
            crtc.byteAddress(row, raster, Math.floor(index / 2)) + (index % 2);
          // Pen 0 is the paper in every firmware text colour scheme, so any
          // other pen is ink - the same rule the renderer's palette lookup
          // makes visible.
          const pens = decodeByte(mode, readScreenByte(addr));
          for (let p = 0; p < pens.length; p++) {
            if (pens[p]) mask |= 0x80 >> (byte * pens.length + p);
          }
        }
        return mask;
      }),
  });
  return { lines, cols, rows };
}
