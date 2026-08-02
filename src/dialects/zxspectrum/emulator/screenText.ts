import {
  buildFontSignatures,
  readFontText,
  type GlyphSignatures,
} from '../../../emulator/fontMatcher';
import type { MachineScreenText } from '../../types';

/**
 * Recovering the Spectrum's screen as characters.
 *
 * The Spectrum keeps no characters anywhere - the display is a 6144-byte
 * bitmap - so the only way back to text is to compare each 8x8 cell against
 * the glyphs the ROM would have drawn. Shared by the 48K and the 128K, which
 * differ only in how a screen byte is fetched: the 128K's shadow screen means
 * its reads go through the paging logic rather than straight at page 5.
 */

/** 32x24 characters, the whole Spectrum display. */
export const SPECTRUM_SCREEN_COLS = 32;
export const SPECTRUM_SCREEN_ROWS = 24;

/**
 * Where the ROM's 8x8 font is indexed from, and the codes it covers.
 *
 * The documented base names code *0*, not the first code with a bitmap: the
 * glyph for code `c` is at `FONT_BASE + c * 8`, and the 32 slots below the
 * space are simply never asked for (the same fact `glyphSources.ts` records
 * for this ROM). Treating the base as the space's own glyph reads the font 256
 * bytes early and turns every cell into a mismatch.
 */
const FONT_BASE = 0x3c00;
const FIRST_CODE = 0x20;
const LAST_CODE = 0x7f;

/**
 * The display file's famously non-linear address for pixel row `y` of the
 * character column `xb`: thirds, then character rows within a third, then
 * pixel rows within a character.
 */
export function spectrumBitmapAddr(y: number, xb: number): number {
  return (
    0x4000 | ((y & 0x07) << 8) | ((y & 0x38) << 2) | ((y & 0xc0) << 5) | xb
  );
}

/**
 * Index the ROM font by glyph shape, once per machine.
 *
 * `origin` defaults to the 48K machine's, where the ROM array is the single
 * 16K image. The 128K keeps both banks in one array and its font lives in the
 * second, so it passes its own origin.
 */
export function spectrumFontSignatures(
  rom: Uint8Array,
  origin: number = FONT_BASE,
): GlyphSignatures {
  return buildFontSignatures({
    glyphByte: (code, row) => rom[origin + code * 8 + row] ?? 0,
    firstCode: FIRST_CODE,
    lastCode: LAST_CODE,
  });
}

/**
 * OCR the whole screen.
 *
 * `readScreenByte` is the machine's own display-file read, so the 128K's
 * shadow screen resolves exactly as it does for rendering. A cell matching no
 * glyph - free-hand pixels, or a program's redefined font - reads as a space.
 */
export function readSpectrumScreenText(
  signatures: GlyphSignatures,
  readScreenByte: (addr: number) => number,
): MachineScreenText {
  const lines = readFontText({
    signatures,
    cols: SPECTRUM_SCREEN_COLS,
    rows: SPECTRUM_SCREEN_ROWS,
    cellMask: (row, col) =>
      Array.from({ length: 8 }, (_, r) =>
        readScreenByte(spectrumBitmapAddr(row * 8 + r, col)),
      ),
  });
  return {
    lines,
    cols: SPECTRUM_SCREEN_COLS,
    rows: SPECTRUM_SCREEN_ROWS,
  };
}
