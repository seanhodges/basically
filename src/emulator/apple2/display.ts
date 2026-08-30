// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { screenGlyph, videoMode } from '../../dialects/apple2/charset';
import {
  DISPLAY_HEIGHT,
  DISPLAY_WIDTH,
  HIRES_PAGE1,
  HIRES_PAGE2,
  TEXT_PAGE1,
  TEXT_PAGE2,
} from '../../dialects/apple2/addresses';
import type { DisplayMode } from './softSwitches';

/**
 * The Apple II's three display modes, drawn into one 280x192 raster.
 *
 * There is no video chip and no frame buffer in the modern sense: a counter
 * chain walks RAM in step with the raster and the byte it fetches *is* the
 * picture, interpreted three different ways depending on which soft switches
 * are thrown. All three share the same 280x192 active area - the text cell is
 * 7x8 and the lo-res block 7x4 - which is why one raster can hold any of them
 * and why the machine advertises the hi-res size as its display size.
 *
 * ### The interleave, which is the whole difficulty
 *
 * None of the three modes addresses memory in raster order. The counter chain
 * was built from the parts that were cheapest to wire, and the layout that fell
 * out of it saves the machine a memory refresh chip - Woz's trade, and the
 * reason a 40x24 text page occupies 1024 bytes instead of 960. Written out:
 *
 * - **text and lo-res**: row `r` starts at `base + 128 x (r mod 8) + 40 x (r div 8)`.
 *   The eight bytes at the end of each 128-byte group (`base + 120 + ...`) are
 *   the "screen holes" no row uses; peripheral cards had them as scratch.
 * - **hi-res**: line `y` starts at
 *   `base + 1024 x (y mod 8) + 128 x ((y div 8) mod 8) + 40 x (y div 64)`, which
 *   is the same idea one level deeper - the same interleave applied within each
 *   of eight 1K bands.
 *
 * Both formulae are pinned by `display.test.ts` against addresses read back off
 * the booted ROM rather than taken on trust.
 *
 * ### What each mode makes of a byte
 *
 * - **Text**, 40x24 at `$0400` (page 2 `$0800`): the low six bits pick one of
 *   the character generator's 64 shapes and the top two bits pick inverse,
 *   flashing or normal video - see the dialect's `charset.ts`, which is the
 *   same table read from the other end.
 * - **Lo-res**, the same 1K page read differently: each byte is two stacked
 *   4-bit colour blocks, the low nibble above the high one. 40x48 full screen,
 *   40x40 with four text lines under it.
 * - **Hi-res**, 8K at `$2000` (page 2 `$4000`): seven pixels to a byte, bit 0
 *   leftmost, with bit 7 selecting which pair of colours the dots take.
 *
 * ### Colour, and how faithful this is
 *
 * The sixteen lo-res colours are rendered from the Apple IIgs's own digital
 * palette, whose first sixteen entries are Apple's later restatement of exactly
 * these colours as `$RGB` nibbles; each nibble is scaled by 17 to fill a byte.
 * On the real machine they are not colours at all but four-bit patterns beating
 * against the colour subcarrier, so a composite monitor's rendering of them
 * varies with its tint control - Apple's own digital values are the closest
 * thing to an authoritative answer.
 *
 * **Hi-res is drawn monochrome**, every set dot white, and bit 7 is ignored.
 * That is a decision rather than an omission. Hi-res colour on this machine is
 * pure NTSC artefacting - the 280 dots are really 140 colour cells, adjacent
 * dots fringe into each other, and reproducing it means simulating the
 * decoder - and Integer BASIC cannot reach hi-res at all except through `CALL`,
 * so nothing this dialect offers the user draws in it. A monochrome raster
 * shows exactly which dots are set, which is what a program poking `$2000`
 * wants to see.
 */

/** The character grid, and the cell the raster is built from. */
export const TEXT_COLS = 40;
export const TEXT_ROWS = 24;
export const CELL_WIDTH = 7;
export const CELL_HEIGHT = 8;

/** Lo-res blocks: two to a text row's height, so 7x4 pixels each. */
export const LORES_ROWS = 48;
export const LORES_BLOCK_HEIGHT = DISPLAY_HEIGHT / LORES_ROWS;

/** Text rows kept at the foot of the screen in mixed mode. */
export const MIXED_TEXT_ROWS = 4;

/** Bytes a display row occupies, of the 128 its group spans. */
export const ROW_BYTES = TEXT_COLS;

/** Bytes a whole text/lo-res page occupies, screen holes included. */
export const TEXT_PAGE_BYTES = 1024;

/** Pixels a hi-res byte carries, and the bit that is not one of them. */
export const HIRES_PIXELS_PER_BYTE = 7;
const HIRES_PALETTE_BIT = 0x80;

/**
 * Fields a flashing character spends showing, and again hiding. The video
 * counter divides the field rate down to produce it; eight each way gives the
 * roughly 4Hz flash the machine is described as having, and is chosen to look
 * right rather than read off the schematic.
 */
const FLASH_FIELDS = 8;

const BACKGROUND = '#000000';
/** Composite white. The machine drove whatever monitor its owner had. */
const FOREGROUND = '#ffffff';

/** RGB triples, as the raster stores them. */
type Rgb = readonly [number, number, number];

/** Expand one `$RGB` nibble triple to eight bits a channel. */
function nibbles(rgb: number): Rgb {
  return [
    ((rgb >> 8) & 0xf) * 17,
    ((rgb >> 4) & 0xf) * 17,
    (rgb & 0xf) * 17,
  ] as const;
}

/**
 * The sixteen lo-res colours, in the order `COLOR=` numbers them. Two of them
 * really are the same grey: 5 and 10 are different bit patterns that beat to
 * the same place, which is a fact about the hardware rather than a mistake
 * here.
 */
export const LORES_PALETTE: readonly Rgb[] = [
  0x000, // 0  black
  0xd03, // 1  magenta
  0x009, // 2  dark blue
  0xd2d, // 3  purple
  0x072, // 4  dark green
  0x555, // 5  grey
  0x22f, // 6  medium blue
  0x6af, // 7  light blue
  0x850, // 8  brown
  0xf60, // 9  orange
  0xaaa, // 10 grey
  0xf98, // 11 pink
  0x0d0, // 12 green
  0xff0, // 13 yellow
  0x4f9, // 14 aquamarine
  0xfff, // 15 white
].map(nibbles);

/** Where the text and lo-res page starts, given the page-2 switch. */
export function textBase(page2: boolean): number {
  return page2 ? TEXT_PAGE2 : TEXT_PAGE1;
}

/** Where the hi-res page starts, given the page-2 switch. */
export function hiresBase(page2: boolean): number {
  return page2 ? HIRES_PAGE2 : HIRES_PAGE1;
}

/** First byte of text/lo-res row `row` (0-23) in the page at `base`. */
export function textRowAddress(base: number, row: number): number {
  return base + 128 * (row % 8) + ROW_BYTES * Math.floor(row / 8);
}

/** First byte of hi-res line `y` (0-191) in the page at `base`. */
export function hiresLineAddress(base: number, y: number): number {
  return (
    base +
    1024 * (y % 8) +
    128 * (Math.floor(y / 8) % 8) +
    ROW_BYTES * Math.floor(y / 64)
  );
}

/** The rows of text the current mode shows: `first` up to but not `end`. */
export function visibleTextRows(mode: DisplayMode): {
  first: number;
  end: number;
} {
  if (!mode.graphics) return { first: 0, end: TEXT_ROWS };
  if (!mode.mixed) return { first: 0, end: 0 };
  return { first: TEXT_ROWS - MIXED_TEXT_ROWS, end: TEXT_ROWS };
}

/**
 * The characters on screen, or null in a mode that shows none. Full-screen
 * graphics is that mode: the text page still holds whatever was last printed
 * there, and reporting it would be reporting something nobody can see.
 */
export function screenTextLines(
  mem: Uint8Array,
  mode: DisplayMode,
): { lines: string[]; cols: number; rows: number } | null {
  const { first, end } = visibleTextRows(mode);
  if (first === end) return null;
  const base = textBase(mode.page2);
  const lines: string[] = [];
  for (let row = first; row < end; row++) {
    const start = textRowAddress(base, row);
    let line = '';
    for (let col = 0; col < TEXT_COLS; col++) {
      line += screenGlyph(mem[start + col] ?? 0xa0);
    }
    lines.push(line);
  }
  return { lines, cols: TEXT_COLS, rows: end - first };
}

export class Apple2Display {
  /** The graphics half of the picture, RGBA, one entry per pixel channel. */
  readonly raster = new Uint8ClampedArray(DISPLAY_WIDTH * DISPLAY_HEIGHT * 4);

  private fields = 0;
  private image: ImageData | null = null;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.fields = 0;
    this.clear();
  }

  /** One video field: the flash phase is counted in these. */
  endField(): void {
    this.fields++;
  }

  /** True while flashing characters are in the showing half of their cycle. */
  get flashOn(): boolean {
    return Math.floor(this.fields / FLASH_FIELDS) % 2 === 0;
  }

  /**
   * Paint the graphics modes into {@link raster}, leaving the text area black
   * for the glyphs {@link renderTo} draws over it. Separate from the canvas work
   * so the interleave can be asserted on pixels without a DOM.
   */
  renderRaster(mem: Uint8Array, mode: DisplayMode): Uint8ClampedArray {
    this.clear();
    if (!mode.graphics) return this.raster;
    const lines = mode.mixed
      ? DISPLAY_HEIGHT - MIXED_TEXT_ROWS * CELL_HEIGHT
      : DISPLAY_HEIGHT;
    if (mode.hires) this.drawHires(mem, hiresBase(mode.page2), lines);
    else this.drawLores(mem, textBase(mode.page2), lines);
    return this.raster;
  }

  /**
   * The whole picture: the graphics raster blitted, then the visible text rows
   * drawn over it.
   *
   * Text goes through the canvas's own font rather than through a copy of the
   * 2513's dot patterns, exactly as the Apple I's terminal does - the character
   * generator is not CPU-addressable on either machine, so there is no image to
   * be faithful to and a monospace face at the machine's own 7x8 cell is what
   * both of them look like.
   */
  renderTo(
    ctx: CanvasRenderingContext2D,
    mem: Uint8Array,
    mode: DisplayMode,
  ): void {
    this.renderRaster(mem, mode);
    if (!this.image) this.image = new ImageData(DISPLAY_WIDTH, DISPLAY_HEIGHT);
    this.image.data.set(this.raster);
    ctx.putImageData(this.image, 0, 0);

    const { first, end } = visibleTextRows(mode);
    if (first === end) return;
    ctx.textBaseline = 'top';
    ctx.font = `${CELL_HEIGHT}px monospace`;
    const base = textBase(mode.page2);
    for (let row = first; row < end; row++) {
      const start = textRowAddress(base, row);
      const y = row * CELL_HEIGHT;
      for (let col = 0; col < TEXT_COLS; col++) {
        this.drawCell(ctx, mem[start + col] ?? 0xa0, col * CELL_WIDTH, y);
      }
    }
  }

  /** One text cell, in whichever of the three video modes its byte selects. */
  private drawCell(
    ctx: CanvasRenderingContext2D,
    code: number,
    x: number,
    y: number,
  ): void {
    const mode = videoMode(code);
    const inverted =
      mode === 'inverse' || (mode === 'flashing' && !this.flashOn);
    if (inverted) {
      ctx.fillStyle = FOREGROUND;
      ctx.fillRect(x, y, CELL_WIDTH, CELL_HEIGHT);
    }
    const glyph = screenGlyph(code);
    if (glyph === ' ') return;
    ctx.fillStyle = inverted ? BACKGROUND : FOREGROUND;
    ctx.fillText(glyph, x, y);
  }

  /** Blank the raster to opaque black. */
  private clear(): void {
    const r = this.raster;
    for (let i = 0; i < r.length; i += 4) {
      r[i] = 0;
      r[i + 1] = 0;
      r[i + 2] = 0;
      r[i + 3] = 255;
    }
  }

  /** The lo-res page: two colour blocks to a byte, the low nibble on top. */
  private drawLores(mem: Uint8Array, base: number, lines: number): void {
    const rows = Math.floor(lines / LORES_BLOCK_HEIGHT);
    for (let row = 0; row < rows; row++) {
      const start = textRowAddress(base, Math.floor(row / 2));
      const shift = row % 2 === 0 ? 0 : 4;
      for (let col = 0; col < TEXT_COLS; col++) {
        const colour =
          LORES_PALETTE[((mem[start + col] ?? 0) >> shift) & 0x0f]!;
        this.fillBlock(
          col * CELL_WIDTH,
          row * LORES_BLOCK_HEIGHT,
          CELL_WIDTH,
          LORES_BLOCK_HEIGHT,
          colour,
        );
      }
    }
  }

  /** The hi-res page: seven dots to a byte, bit 0 leftmost, drawn white. */
  private drawHires(mem: Uint8Array, base: number, lines: number): void {
    const r = this.raster;
    for (let y = 0; y < lines; y++) {
      const start = hiresLineAddress(base, y);
      for (let byte = 0; byte < ROW_BYTES; byte++) {
        // Bit 7 picks the colour pair the dots take on a composite monitor and
        // shifts them half a dot; neither survives a monochrome raster.
        const bits = (mem[start + byte] ?? 0) & ~HIRES_PALETTE_BIT;
        if (bits === 0) continue;
        for (let bit = 0; bit < HIRES_PIXELS_PER_BYTE; bit++) {
          if ((bits & (1 << bit)) === 0) continue;
          const i =
            (y * DISPLAY_WIDTH + byte * HIRES_PIXELS_PER_BYTE + bit) * 4;
          r[i] = 255;
          r[i + 1] = 255;
          r[i + 2] = 255;
        }
      }
    }
  }

  private fillBlock(
    x: number,
    y: number,
    w: number,
    h: number,
    [red, green, blue]: Rgb,
  ): void {
    const r = this.raster;
    for (let dy = 0; dy < h; dy++) {
      let i = ((y + dy) * DISPLAY_WIDTH + x) * 4;
      for (let dx = 0; dx < w; dx++) {
        r[i] = red;
        r[i + 1] = green;
        r[i + 2] = blue;
        i += 4;
      }
    }
  }
}
