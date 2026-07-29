import { describe, expect, it } from 'vitest';
import { Teletext } from 'jsbeeb/src/teletext.js';
import { mosaicChar } from './charset';
import { sextantGlyph } from '../sextants';

/**
 * Crosscheck the mosaic mapping against the SAA5050 the IDE actually ships:
 * jsbeeb's Teletext builds its graphics glyph set at construction, so for every
 * byte the charset claims is a mosaic we can ask the emulator which of the six
 * cells it lights and compare that with the cells encoded in the Unicode
 * sextant we emit - the same spirit as `src/dialects/sinclairGraphics.test.ts`
 * checking Sinclair spellings against the ROM font.
 *
 * This is what pins the two facts the audit cites: a code is a mosaic iff bit
 * 5 is set (so 0xC0-0xDF are letters, not graphics), and the cells sit in bits
 * 0-4 and 6 of the code.
 */

const teletext = new Teletext();

/** Glyph-set row word for a top-bit character code (rows 0-19). */
function row(glyphs: Uint32Array, code: number, r: number): number {
  return glyphs[(code & 0x7f) * 20 - 0x20 * 20 + r]! >>> 0;
}

/**
 * The six 2×3 cells as jsbeeb draws them on the 12×20 hi-res grid: the top
 * and bottom cells are six scanlines, the middle two are eight, and each row
 * word packs the left half of the cell in bits 0-15 and the right in 16-31.
 */
const CELLS = [
  { bit: 0, rows: [0, 5], shift: 0 }, // top-left
  { bit: 1, rows: [0, 5], shift: 16 }, // top-right
  { bit: 2, rows: [6, 13], shift: 0 }, // middle-left
  { bit: 3, rows: [6, 13], shift: 16 }, // middle-right
  { bit: 4, rows: [14, 19], shift: 0 }, // bottom-left
  { bit: 5, rows: [14, 19], shift: 16 }, // bottom-right
] as const;

/** The cell bitmap jsbeeb lights for a code, insisting each cell is solid. */
function litCells(code: number): number {
  let pattern = 0;
  for (const cell of CELLS) {
    const halves = [];
    for (let r = cell.rows[0]; r <= cell.rows[1]; r++) {
      halves.push(
        (row(teletext.graphicsGlyphs, code, r) >>> cell.shift) & 0xffff,
      );
    }
    // A mosaic cell is all-or-nothing: every scanline fully inked or empty.
    const lit = halves[0]! !== 0;
    for (const half of halves) expect(half).toBe(lit ? 0xffff : 0);
    if (lit) pattern |= 1 << cell.bit;
  }
  return pattern;
}

// Invert sextantGlyph so the emitted character can be read back to its cells.
const GLYPH_PATTERN = new Map<string, number>();
for (let pattern = 1; pattern < 64; pattern++) {
  GLYPH_PATTERN.set(sextantGlyph(pattern), pattern);
}

const MOSAICS: number[] = [];
for (let code = 0xa1; code <= 0xbf; code++) MOSAICS.push(code);
for (let code = 0xe0; code <= 0xff; code++) MOSAICS.push(code);

describe('MODE 7 mosaics against jsbeeb’s SAA5050', () => {
  it('every mapped mosaic byte lights exactly the cells its sextant encodes', () => {
    for (const code of MOSAICS) {
      const char = mosaicChar(code);
      expect(char, `0x${code.toString(16)} has a character`).toBeDefined();
      const claimed = GLYPH_PATTERN.get(char!);
      expect(claimed, `${char} reads back to a sextant pattern`).toBeDefined();
      expect(litCells(code), `0x${code.toString(16)} -> ${char}`).toBe(claimed);
    }
  });

  it('the blank mosaic 0xA0 draws nothing, which is why it stays escaped', () => {
    for (let r = 0; r < 20; r++) {
      expect(row(teletext.graphicsGlyphs, 0xa0, r)).toBe(0);
    }
    expect(mosaicChar(0xa0)).toBeUndefined();
  });

  it('0xC0-0xDF blast through as capitals, so they are not graphics', () => {
    for (let code = 0xc0; code <= 0xdf; code++) {
      for (let r = 0; r < 20; r++) {
        expect(
          row(teletext.graphicsGlyphs, code, r),
          `0x${code.toString(16)} row ${r}`,
        ).toBe(row(teletext.normalGlyphs, code, r));
      }
      expect(mosaicChar(code)).toBeUndefined();
    }
  });
});
