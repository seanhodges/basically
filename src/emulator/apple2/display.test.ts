// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  Apple2Display,
  CELL_HEIGHT,
  CELL_WIDTH,
  LORES_BLOCK_HEIGHT,
  LORES_PALETTE,
  LORES_ROWS,
  MIXED_TEXT_ROWS,
  ROW_BYTES,
  screenTextLines,
  TEXT_COLS,
  TEXT_PAGE_BYTES,
  TEXT_ROWS,
  hiresLineAddress,
  textRowAddress,
  visibleTextRows,
} from './display';
import {
  DISPLAY_HEIGHT,
  DISPLAY_WIDTH,
  HIRES_PAGE1,
  HIRES_PAGE2,
  TEXT_PAGE1,
  TEXT_PAGE2,
} from '../../dialects/apple2/addresses';
import type { DisplayMode } from './softSwitches';

const TEXT: DisplayMode = {
  graphics: false,
  mixed: false,
  page2: false,
  hires: false,
};
const LORES: DisplayMode = { ...TEXT, graphics: true, mixed: true };
const HIRES: DisplayMode = { ...TEXT, graphics: true, hires: true };

function ram(): Uint8Array {
  return new Uint8Array(0x10000).fill(0xa0);
}

/** One pixel of the raster, as an RGB triple. */
function pixel(
  raster: Uint8ClampedArray,
  x: number,
  y: number,
): [number, number, number] {
  const i = (y * DISPLAY_WIDTH + x) * 4;
  return [raster[i]!, raster[i + 1]!, raster[i + 2]!];
}

describe('the display interleave', () => {
  it('starts each text row 128 bytes on, and each group of eight 40', () => {
    expect(textRowAddress(TEXT_PAGE1, 0)).toBe(0x0400);
    expect(textRowAddress(TEXT_PAGE1, 1)).toBe(0x0480);
    expect(textRowAddress(TEXT_PAGE1, 7)).toBe(0x0780);
    expect(textRowAddress(TEXT_PAGE1, 8)).toBe(0x0428);
    expect(textRowAddress(TEXT_PAGE1, 23)).toBe(0x07d0);
    expect(textRowAddress(TEXT_PAGE2, 0)).toBe(0x0800);
  });

  it('tiles the page with no row overlapping another', () => {
    const seen = new Set<number>();
    for (let row = 0; row < TEXT_ROWS; row++) {
      const start = textRowAddress(TEXT_PAGE1, row);
      for (let col = 0; col < TEXT_COLS; col++) {
        expect(seen.has(start + col)).toBe(false);
        seen.add(start + col);
        expect(start + col).toBeLessThan(TEXT_PAGE1 + TEXT_PAGE_BYTES);
      }
    }
    // 24 x 40 of the page's 1024 bytes; the other 64 are the screen holes.
    expect(seen.size).toBe(TEXT_ROWS * TEXT_COLS);
  });

  it('interleaves hi-res lines within, between and across its 1K bands', () => {
    expect(hiresLineAddress(HIRES_PAGE1, 0)).toBe(0x2000);
    expect(hiresLineAddress(HIRES_PAGE1, 1)).toBe(0x2400);
    expect(hiresLineAddress(HIRES_PAGE1, 8)).toBe(0x2080);
    expect(hiresLineAddress(HIRES_PAGE1, 64)).toBe(0x2028);
    expect(hiresLineAddress(HIRES_PAGE1, 191)).toBe(0x3fd0);
    expect(hiresLineAddress(HIRES_PAGE2, 0)).toBe(0x4000);
  });

  it('tiles the hi-res page with no line overlapping another', () => {
    const seen = new Set<number>();
    for (let y = 0; y < DISPLAY_HEIGHT; y++) {
      const start = hiresLineAddress(HIRES_PAGE1, y);
      for (let byte = 0; byte < ROW_BYTES; byte++) {
        expect(seen.has(start + byte)).toBe(false);
        seen.add(start + byte);
        expect(start + byte).toBeLessThan(HIRES_PAGE2);
      }
    }
    expect(seen.size).toBe(DISPLAY_HEIGHT * ROW_BYTES);
  });
});

describe('screenTextLines', () => {
  it('reads the whole page in text mode, through the machine charset', () => {
    const mem = ram();
    const start = textRowAddress(TEXT_PAGE1, 5);
    for (const [i, ch] of [...'HELLO'].entries()) {
      mem[start + i] = ch.charCodeAt(0) | 0x80;
    }
    // Inverse and flashing draw the same shapes, so they read back as them.
    mem[start + 6] = 0x01; // inverse A
    mem[start + 7] = 0x42; // flashing B
    const screen = screenTextLines(mem, TEXT);
    expect(screen?.rows).toBe(TEXT_ROWS);
    expect(screen?.cols).toBe(TEXT_COLS);
    expect(screen?.lines[5]).toBe('HELLO AB'.padEnd(TEXT_COLS, ' '));
    expect(screen?.lines.every((line) => line.length === TEXT_COLS)).toBe(true);
  });

  it('reads only the four lines mixed mode really shows', () => {
    const mem = ram();
    mem[textRowAddress(TEXT_PAGE1, 20)] = 'Z'.charCodeAt(0) | 0x80;
    const screen = screenTextLines(mem, LORES);
    expect(screen?.rows).toBe(MIXED_TEXT_ROWS);
    expect(screen?.lines[0]?.[0]).toBe('Z');
  });

  it('answers null in full-screen graphics, where nothing is text', () => {
    expect(screenTextLines(ram(), HIRES)).toBeNull();
    expect(visibleTextRows(HIRES)).toEqual({ first: 0, end: 0 });
  });

  it('follows the page-2 switch', () => {
    const mem = ram();
    mem[textRowAddress(TEXT_PAGE2, 0)] = 'Q'.charCodeAt(0) | 0x80;
    expect(screenTextLines(mem, { ...TEXT, page2: true })?.lines[0]?.[0]).toBe(
      'Q',
    );
    expect(screenTextLines(mem, TEXT)?.lines[0]?.[0]).toBe(' ');
  });
});

describe('Apple2Display', () => {
  it('leaves the raster black in text mode', () => {
    const display = new Apple2Display();
    const raster = display.renderRaster(ram(), TEXT);
    expect(pixel(raster, 0, 0)).toEqual([0, 0, 0]);
    expect(pixel(raster, 279, 191)).toEqual([0, 0, 0]);
    // Opaque throughout, so a canvas never shows through the picture.
    expect(raster[3]).toBe(255);
  });

  it('draws a lo-res byte as two stacked blocks, low nibble on top', () => {
    const display = new Apple2Display();
    const mem = new Uint8Array(0x10000);
    // Row 2 of the text page holds lo-res rows 4 and 5.
    mem[textRowAddress(TEXT_PAGE1, 2) + 3] = 0xd2; // low 2, high 13
    const raster = display.renderRaster(mem, LORES);
    const x = 3 * CELL_WIDTH;
    expect(pixel(raster, x, 4 * LORES_BLOCK_HEIGHT)).toEqual([
      ...LORES_PALETTE[2]!,
    ]);
    expect(pixel(raster, x + 6, 5 * LORES_BLOCK_HEIGHT)).toEqual([
      ...LORES_PALETTE[13]!,
    ]);
    // ...and the block really is seven wide by four tall.
    expect(pixel(raster, x + 7, 4 * LORES_BLOCK_HEIGHT)).toEqual([0, 0, 0]);
    expect(pixel(raster, x, 6 * LORES_BLOCK_HEIGHT)).toEqual([0, 0, 0]);
  });

  it('stops lo-res above the text window in mixed mode, and not in full', () => {
    const display = new Apple2Display();
    const mem = new Uint8Array(0x10000);
    // The bottom four text rows carry lo-res rows 40-47.
    for (let row = 0; row < TEXT_ROWS; row++) {
      mem.fill(
        0xff,
        textRowAddress(TEXT_PAGE1, row),
        textRowAddress(TEXT_PAGE1, row) + TEXT_COLS,
      );
    }
    const mixed = display.renderRaster(mem, LORES);
    const firstTextLine = (TEXT_ROWS - MIXED_TEXT_ROWS) * CELL_HEIGHT;
    expect(pixel(mixed, 0, firstTextLine - 1)).toEqual([...LORES_PALETTE[15]!]);
    expect(pixel(mixed, 0, firstTextLine)).toEqual([0, 0, 0]);

    const full = display.renderRaster(mem, { ...LORES, mixed: false });
    expect(pixel(full, 0, DISPLAY_HEIGHT - 1)).toEqual([...LORES_PALETTE[15]!]);
    expect(LORES_ROWS * LORES_BLOCK_HEIGHT).toBe(DISPLAY_HEIGHT);
  });

  it('draws hi-res as seven monochrome dots a byte, bit 0 leftmost', () => {
    const display = new Apple2Display();
    const mem = new Uint8Array(0x10000);
    // Bit 7 selects a colour pair on a composite monitor and nothing here, so
    // a byte of $81 must draw one dot rather than two.
    mem[hiresLineAddress(HIRES_PAGE1, 83) + 1] = 0x81;
    const raster = display.renderRaster(mem, HIRES);
    expect(pixel(raster, 7, 83)).toEqual([255, 255, 255]);
    expect(pixel(raster, 8, 83)).toEqual([0, 0, 0]);
    expect(pixel(raster, 13, 83)).toEqual([0, 0, 0]);
    expect(pixel(raster, 0, 83)).toEqual([0, 0, 0]);
    expect(pixel(raster, 7, 82)).toEqual([0, 0, 0]);
  });

  it('flashes on a phase counted in fields, not in frames drawn', () => {
    const display = new Apple2Display();
    expect(display.flashOn).toBe(true);
    for (let field = 0; field < 8; field++) display.endField();
    expect(display.flashOn).toBe(false);
    for (let field = 0; field < 8; field++) display.endField();
    expect(display.flashOn).toBe(true);
    display.reset();
    expect(display.flashOn).toBe(true);
  });
});

describe('the lo-res palette', () => {
  it('runs from black to white, with the two greys the hardware repeats', () => {
    expect(LORES_PALETTE).toHaveLength(16);
    expect(LORES_PALETTE[0]).toEqual([0, 0, 0]);
    expect(LORES_PALETTE[15]).toEqual([255, 255, 255]);
    // 5 and 10 are different bit patterns that beat to the same hue; both are
    // grey, and the lighter of the two is 10.
    for (const grey of [5, 10]) {
      const [r, g, b] = LORES_PALETTE[grey]!;
      expect(r).toBe(g);
      expect(g).toBe(b);
    }
    expect(LORES_PALETTE[10]![0]).toBeGreaterThan(LORES_PALETTE[5]![0]);
  });
});
