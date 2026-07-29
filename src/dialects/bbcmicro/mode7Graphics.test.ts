import { describe, expect, it } from 'vitest';
import { Teletext } from 'jsbeeb/src/teletext.js';
import { BbcDefaultPalette } from 'jsbeeb/src/bbc-palette.js';
import { mosaicChar, TELETEXT_NAMES } from './charset';
import { sextantGlyph } from '../sextants';
import { BBC_GRAPHICS_COLOURS, BBC_GRAPHICS_STYLES } from './graphics';
import { teletextChipColour } from './teletextChips';

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

/**
 * The other half of what makes a mosaic byte draw as a mosaic: the row has to
 * be in graphics mode. That is a property of the control codes, so it is
 * derived from the same chip rather than written down - which is what stops
 * the palette from one day offering a code that turns graphics *off*.
 *
 * The chip has a seven-bit data bus (`fetchData` stores `data & 0x7f`), so the
 * stored byte 0x91 reaches `handleControlCode` as 0x11.
 */
describe('MODE 7 control codes against jsbeeb’s SAA5050', () => {
  /** A fresh chip, since the flags it sets persist across characters. */
  const afterControl = (code: number): Teletext => {
    const tt = new Teletext();
    tt.handleControlCode(code & 0x7f);
    return tt;
  };

  it('each palette graphics colour puts the row into graphics', () => {
    for (const entry of BBC_GRAPHICS_COLOURS) {
      const tt = afterControl(entry.code);
      const where = `0x${entry.code.toString(16)} (${entry.chip?.title})`;
      expect(tt.gfx, where).toBe(true);
      expect(tt.nextGlyphs, where).toBe(tt.graphicsGlyphs);
    }
  });

  it('the text colours take the row back out of graphics', () => {
    // Why the palette does not offer them next to the mosaics: a cell for
    // {RED} beside the shapes would hand the user the code that stops them
    // drawing.
    for (let code = 0x81; code <= 0x87; code++) {
      const tt = afterControl(code);
      const where = `0x${code.toString(16)} (${TELETEXT_NAMES[code]})`;
      expect(tt.gfx, where).toBe(false);
      expect(tt.nextGlyphs, where).toBe(tt.normalGlyphs);
    }
  });

  it('offers exactly the codes that turn graphics on', () => {
    const turnsOn: number[] = [];
    for (const key of Object.keys(TELETEXT_NAMES)) {
      const code = Number(key);
      if (afterControl(code).gfx) turnsOn.push(code);
    }
    expect(BBC_GRAPHICS_COLOURS.map((e) => e.code).sort()).toEqual(
      turnsOn.sort(),
    );
  });

  it('the style codes select the mosaic sets they name', () => {
    const styles = new Map(BBC_GRAPHICS_STYLES.map((e) => [e.code, e]));
    expect([...styles.keys()]).toEqual([0x99, 0x9a, 0x9e, 0x9f]);

    // Separated and contiguous are only meaningful while graphics are on, so
    // set a graphics colour first, exactly as a program would.
    const tt = new Teletext();
    tt.handleControlCode(0x97 & 0x7f); // GRAPHICS WHITE
    expect(tt.nextGlyphs).toBe(tt.graphicsGlyphs);
    tt.handleControlCode(0x9a & 0x7f); // SEPARATED
    expect(tt.sep).toBe(true);
    expect(tt.nextGlyphs).toBe(tt.separatedGlyphs);
    tt.handleControlCode(0x99 & 0x7f); // CONTIGUOUS
    expect(tt.sep).toBe(false);
    expect(tt.nextGlyphs).toBe(tt.graphicsGlyphs);
  });

  it('the chip colours are the machine’s own', () => {
    // The chips are drawn in the colours the emulator pane paints with, so a
    // white graphics chip and white mosaics on screen are the same white.
    // jsbeeb stores ABGR (0xffBBGGRR); the chips are CSS #rrggbb.
    const css = (abgr: number): string => {
      const r = abgr & 0xff;
      const g = (abgr >>> 8) & 0xff;
      const b = (abgr >>> 16) & 0xff;
      return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
    };
    for (let colour = 1; colour <= 7; colour++) {
      const expected = css(BbcDefaultPalette[colour]!);
      expect(teletextChipColour(0x90 | colour), `graphics ${colour}`).toBe(
        expected,
      );
      expect(teletextChipColour(0x80 | colour), `text ${colour}`).toBe(
        expected,
      );
    }
    // Codes that select no colour say so rather than guessing one.
    expect(teletextChipColour(0x99)).toBeUndefined();
    expect(teletextChipColour(0x9e)).toBeUndefined();
  });
});
