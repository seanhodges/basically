// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { Tms9918 } from './vdp';

/**
 * Canvas geometry for the TMS9918A-family VDP: the 256x192 active window plus
 * the border the chip draws around it.
 *
 * The border is a crop rather than a measurement. A PAL frame off this part is
 * 313 lines of 342 pixels and only 192x256 of that is active, so the true
 * border is far wider than any screen wants; 32 pixels each side and 24 above
 * and below is the window emulators have long settled on, and it is enough for
 * a program setting the backdrop colour to see it change.
 */
export const ACTIVE_WIDTH = 256;
export const ACTIVE_HEIGHT = 192;
export const BORDER_X = 32;
export const BORDER_Y = 24;
export const DISPLAY_WIDTH = ACTIVE_WIDTH + 2 * BORDER_X;
export const DISPLAY_HEIGHT = ACTIVE_HEIGHT + 2 * BORDER_Y;

/** Text mode draws six-pixel characters, so its 40 columns are 240 wide. */
export const TEXT_COLUMNS = 40;
export const TEXT_CHAR_WIDTH = 6;
/** Every mode is 24 rows of eight-pixel-high characters. */
export const CHAR_ROWS = 24;
export const CHAR_HEIGHT = 8;
/** The graphics modes are 32 columns of eight-pixel characters. */
export const GRAPHIC_COLUMNS = 32;

const VRAM_MASK = 0x3fff;
/** Sprite attributes: Y, X, pattern, colour. */
const SPRITE_COUNT = 32;
const SPRITE_ATTRIBUTE_BYTES = 4;
/** A sprite Y of 208 ends the list: nothing after it is drawn or evaluated. */
const SPRITE_LIST_END = 208;
/** Y values from 224 up are negative, sliding a sprite in from above. */
const SPRITE_Y_NEGATIVE = 224;
/** Only four sprites are shown per line; a fifth sets the status flag. */
const SPRITES_PER_LINE = 4;
/** Attribute byte 3 bit 7 shifts the sprite 32 pixels left ("early clock"). */
const EARLY_CLOCK = 0x80;

/**
 * The TMS9918A's fixed sixteen colours, as RGB. Colour 0 is transparent, which
 * over the active display means the backdrop shows through; there is no palette
 * register on this part, so these values are the whole colour model.
 */
export const TMS9918_PALETTE: readonly (readonly [number, number, number])[] = [
  [0, 0, 0], //        0  transparent (drawn as the backdrop)
  [0, 0, 0], //        1  black
  [33, 200, 66], //    2  medium green
  [94, 220, 120], //   3  light green
  [84, 85, 237], //    4  dark blue
  [125, 118, 252], //  5  light blue
  [212, 82, 77], //    6  dark red
  [66, 235, 245], //   7  cyan
  [252, 85, 84], //    8  medium red
  [255, 121, 120], //  9  light red
  [212, 193, 84], // 10  dark yellow
  [230, 206, 128], // 11  light yellow
  [33, 176, 59], //   12  dark green
  [201, 91, 186], //  13  magenta
  [204, 204, 204], // 14  grey
  [255, 255, 255], // 15  white
];

/** What drawing a frame found out about the sprites on it. */
export interface SpriteReport {
  collision: boolean;
  /** The first sprite past the fourth on some line, or null when none was. */
  fifthSprite: number | null;
}

/**
 * The renderer, which owns its own scratch planes.
 *
 * A frame is drawn all at once from the VDP's current state rather than raster
 * by raster. Nothing on MSX1 changes the picture mid-frame without also
 * changing it for the next one - there is no raster interrupt on this part and
 * no way for a program to time itself to the beam - so a scanline-accurate
 * renderer would cost every frame and buy nothing back.
 */
export class MsxDisplay {
  /** The active window as colour indices, before the sprite plane is over it. */
  private readonly pixels = new Uint8Array(ACTIVE_WIDTH * ACTIVE_HEIGHT);
  /** One line of sprite colour, and which sprite claimed each pixel. */
  private readonly spriteLine = new Int8Array(ACTIVE_WIDTH);
  private readonly spriteOwner = new Int8Array(ACTIVE_WIDTH);

  /**
   * Draw one frame into `out` (RGBA, {@link DISPLAY_WIDTH} x
   * {@link DISPLAY_HEIGHT}) and report what the sprite pass found.
   */
  render(vdp: Tms9918, out: Uint8ClampedArray): SpriteReport {
    const backdrop = vdp.backdropColour;
    if (!vdp.displayEnabled || vdp.mode === 'undocumented') {
      paintAll(out, backdrop);
      return { collision: false, fifthSprite: null };
    }
    // Only the border is painted here; every active pixel is written below, so
    // painting the whole frame first would write two thirds of it twice.
    paintBorder(out, backdrop);

    this.pixels.fill(backdrop);
    switch (vdp.mode) {
      case 'text':
        this.drawText(vdp);
        break;
      case 'graphic1':
        this.drawGraphic1(vdp);
        break;
      case 'graphic2':
        this.drawGraphic2(vdp);
        break;
      case 'multicolour':
        this.drawMulticolour(vdp);
        break;
    }

    const report = vdp.spritesVisible
      ? this.drawSprites(vdp)
      : { collision: false, fifthSprite: null };

    for (let y = 0; y < ACTIVE_HEIGHT; y++) {
      const row = (y + BORDER_Y) * DISPLAY_WIDTH + BORDER_X;
      const src = y * ACTIVE_WIDTH;
      for (let x = 0; x < ACTIVE_WIDTH; x++) {
        paint(out, row + x, this.pixels[src + x]!);
      }
    }
    return report;
  }

  /**
   * SCREEN 0: 40 columns of six-pixel characters in the two colours register 7
   * holds, with no colour table and no sprites. The 240 pixels the columns take
   * leave eight either side, drawn in the backdrop colour - so a text screen is
   * genuinely narrower than a graphics one rather than stretched to fit.
   */
  private drawText(vdp: Tms9918): void {
    const { vram } = vdp;
    const pixels = this.pixels;
    const name = vdp.nameTable;
    const pattern = vdp.patternTable;
    const fg = vdp.textColour;
    const bg = vdp.backdropColour;
    const left = (ACTIVE_WIDTH - TEXT_COLUMNS * TEXT_CHAR_WIDTH) / 2;
    for (let row = 0; row < CHAR_ROWS; row++) {
      for (let col = 0; col < TEXT_COLUMNS; col++) {
        const code = vram[(name + row * TEXT_COLUMNS + col) & VRAM_MASK]!;
        const x0 = left + col * TEXT_CHAR_WIDTH;
        for (let line = 0; line < CHAR_HEIGHT; line++) {
          const bits = vram[(pattern + code * 8 + line) & VRAM_MASK]!;
          const base = (row * CHAR_HEIGHT + line) * ACTIVE_WIDTH + x0;
          for (let bit = 0; bit < TEXT_CHAR_WIDTH; bit++) {
            pixels[base + bit] = bits & (0x80 >> bit) ? fg : bg;
          }
        }
      }
    }
  }

  /**
   * SCREEN 1: 32 columns of eight-pixel characters, with one colour-table byte
   * per group of eight patterns - which is why an MSX BASIC program that wants
   * a colour per character has to move up to SCREEN 2.
   */
  private drawGraphic1(vdp: Tms9918): void {
    const { vram } = vdp;
    const pixels = this.pixels;
    const name = vdp.nameTable;
    const pattern = vdp.patternTable;
    const colour = vdp.colourTable;
    const backdrop = vdp.backdropColour;
    for (let row = 0; row < CHAR_ROWS; row++) {
      for (let col = 0; col < GRAPHIC_COLUMNS; col++) {
        const code = vram[(name + row * GRAPHIC_COLUMNS + col) & VRAM_MASK]!;
        const attr = vram[(colour + (code >> 3)) & VRAM_MASK]!;
        const fg = attr >> 4 || backdrop;
        const bg = attr & 0x0f || backdrop;
        for (let line = 0; line < CHAR_HEIGHT; line++) {
          const bits = vram[(pattern + code * 8 + line) & VRAM_MASK]!;
          const base = (row * CHAR_HEIGHT + line) * ACTIVE_WIDTH + col * 8;
          for (let bit = 0; bit < 8; bit++) {
            pixels[base + bit] = bits & (0x80 >> bit) ? fg : bg;
          }
        }
      }
    }
  }

  /**
   * SCREEN 2: the same 32x24 grid, but the screen is three banks of 256
   * patterns and every pattern carries a colour byte per pixel row. That is what
   * makes it a 256x192 bitmap - MSX BASIC fills the name table with 0-255 three
   * times over and then draws by writing patterns.
   */
  private drawGraphic2(vdp: Tms9918): void {
    const { vram } = vdp;
    const pixels = this.pixels;
    const name = vdp.nameTable;
    const pattern = vdp.patternTable;
    const colour = vdp.colourTable;
    const patternMask = vdp.patternMask;
    const colourMask = vdp.colourMask;
    const backdrop = vdp.backdropColour;
    for (let row = 0; row < CHAR_ROWS; row++) {
      const bank = (row >> 3) << 8;
      for (let col = 0; col < GRAPHIC_COLUMNS; col++) {
        const code =
          bank | vram[(name + row * GRAPHIC_COLUMNS + col) & VRAM_MASK]!;
        const patternBase = pattern + (code & patternMask) * 8;
        const colourBase = colour + (code & colourMask) * 8;
        for (let line = 0; line < CHAR_HEIGHT; line++) {
          const bits = vram[(patternBase + line) & VRAM_MASK]!;
          const attr = vram[(colourBase + line) & VRAM_MASK]!;
          const fg = attr >> 4 || backdrop;
          const bg = attr & 0x0f || backdrop;
          const base = (row * CHAR_HEIGHT + line) * ACTIVE_WIDTH + col * 8;
          for (let bit = 0; bit < 8; bit++) {
            pixels[base + bit] = bits & (0x80 >> bit) ? fg : bg;
          }
        }
      }
    }
  }

  /**
   * SCREEN 3: 64x48 blocks of solid colour, four pixels square. A pattern still
   * holds eight bytes, but only two of them are used per character row and which
   * two depends on the row - so one pattern draws different blocks four rows
   * apart and the whole screen fits in a quarter of the pattern table.
   */
  private drawMulticolour(vdp: Tms9918): void {
    const { vram } = vdp;
    const pixels = this.pixels;
    const name = vdp.nameTable;
    const pattern = vdp.patternTable;
    for (let row = 0; row < CHAR_ROWS; row++) {
      for (let col = 0; col < GRAPHIC_COLUMNS; col++) {
        const code = vram[(name + row * GRAPHIC_COLUMNS + col) & VRAM_MASK]!;
        const rowPair = pattern + code * 8 + ((row & 3) << 1);
        for (let line = 0; line < CHAR_HEIGHT; line++) {
          const byte = vram[(rowPair + (line >> 2)) & VRAM_MASK]!;
          const base = (row * CHAR_HEIGHT + line) * ACTIVE_WIDTH + col * 8;
          for (let bit = 0; bit < 8; bit++) {
            pixels[base + bit] = bit < 4 ? byte >> 4 : byte & 0x0f;
          }
        }
      }
    }
  }

  /**
   * Composite the sprite plane and report the two status flags it sets.
   *
   * Sprite 0 is in front, and the four-per-line limit is a display limit rather
   * than a drawing order: the fifth sprite found on a line is not drawn and its
   * number is latched. A pattern bit claims its pixel whatever the sprite's
   * colour, so a colour-0 sprite is invisible and still collides - which is how
   * programs use one as a hit box.
   */
  private drawSprites(vdp: Tms9918): SpriteReport {
    const { vram } = vdp;
    const pixels = this.pixels;
    const line = this.spriteLine;
    const owner = this.spriteOwner;
    const attributes = vdp.spriteAttributeTable;
    const patterns = vdp.spritePatternTable;
    const size = vdp.spritesLarge ? 16 : 8;
    const scale = vdp.spritesMagnified ? 2 : 1;
    const extent = size * scale;

    // How far down the list the chip looks, found once rather than per line.
    let count = SPRITE_COUNT;
    for (let s = 0; s < SPRITE_COUNT; s++) {
      const y = vram[(attributes + s * SPRITE_ATTRIBUTE_BYTES) & VRAM_MASK]!;
      if (y === SPRITE_LIST_END) {
        count = s;
        break;
      }
    }

    let collision = false;
    let fifthSprite: number | null = null;
    if (count === 0) return { collision, fifthSprite };
    for (let y = 0; y < ACTIVE_HEIGHT; y++) {
      line.fill(-1);
      owner.fill(-1);
      let onLine = 0;
      for (let s = 0; s < count; s++) {
        const attr = (attributes + s * SPRITE_ATTRIBUTE_BYTES) & VRAM_MASK;
        // A sprite's Y attribute is one less than the line it starts on, and
        // values from 224 up count as negative so a sprite can be half off the
        // top of the screen.
        const raw = vram[attr]!;
        const top = (raw >= SPRITE_Y_NEGATIVE ? raw - 256 : raw) + 1;
        const row = y - top;
        if (row < 0 || row >= extent) continue;
        onLine++;
        if (onLine > SPRITES_PER_LINE) {
          if (fifthSprite === null) fifthSprite = s;
          break; // the chip stops looking once the line is full
        }
        const colour = vram[(attr + 3) & VRAM_MASK]!;
        const ink = colour & 0x0f;
        const x =
          vram[(attr + 1) & VRAM_MASK]! - (colour & EARLY_CLOCK ? 32 : 0);
        // A 16x16 sprite is four 8x8 quarters from an index rounded down to a
        // multiple of four, stored as the left half's sixteen rows then the
        // right half's.
        const index =
          vram[(attr + 2) & VRAM_MASK]! & (vdp.spritesLarge ? 0xfc : 0xff);
        const patternBase = patterns + index * 8;
        const spriteRow = (row / scale) | 0;
        for (let half = 0; half < size / 8; half++) {
          const bits = vram[(patternBase + half * 16 + spriteRow) & VRAM_MASK]!;
          for (let bit = 0; bit < 8; bit++) {
            if (!(bits & (0x80 >> bit))) continue;
            const x0 = x + (half * 8 + bit) * scale;
            for (let d = 0; d < scale; d++) {
              const px = x0 + d;
              if (px < 0 || px >= ACTIVE_WIDTH) continue;
              if (owner[px]! >= 0) {
                collision = true;
              } else {
                owner[px] = s;
                line[px] = ink;
              }
            }
          }
        }
      }
      const dest = y * ACTIVE_WIDTH;
      for (let x = 0; x < ACTIVE_WIDTH; x++) {
        if (line[x]! > 0) pixels[dest + x] = line[x]!;
      }
    }
    return { collision, fifthSprite };
  }
}

/** Paint the whole buffer one colour, for a blanked screen. */
function paintAll(out: Uint8ClampedArray, colour: number): void {
  paintRun(out, 0, DISPLAY_WIDTH * DISPLAY_HEIGHT, colour);
}

/** Paint the frame the active window does not cover. */
function paintBorder(out: Uint8ClampedArray, colour: number): void {
  paintRun(out, 0, BORDER_Y * DISPLAY_WIDTH, colour);
  for (let y = BORDER_Y; y < BORDER_Y + ACTIVE_HEIGHT; y++) {
    paintRun(out, y * DISPLAY_WIDTH, BORDER_X, colour);
    paintRun(
      out,
      y * DISPLAY_WIDTH + BORDER_X + ACTIVE_WIDTH,
      BORDER_X,
      colour,
    );
  }
  const below = (BORDER_Y + ACTIVE_HEIGHT) * DISPLAY_WIDTH;
  paintRun(out, below, BORDER_Y * DISPLAY_WIDTH, colour);
}

function paintRun(
  out: Uint8ClampedArray,
  first: number,
  count: number,
  colour: number,
): void {
  const [r, g, b] = TMS9918_PALETTE[colour & 0x0f]!;
  for (let i = first * 4, end = (first + count) * 4; i < end; i += 4) {
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = 255;
  }
}

function paint(out: Uint8ClampedArray, pixel: number, colour: number): void {
  const rgb = TMS9918_PALETTE[colour & 0x0f]!;
  const i = pixel * 4;
  out[i] = rgb[0];
  out[i + 1] = rgb[1];
  out[i + 2] = rgb[2];
  out[i + 3] = 255;
}
