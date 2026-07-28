import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  GRAPHIC_UNICODE as ZX81_GRAPHICS,
  ESCAPES as ZX81_ESCAPES,
} from './zx81/charset';
import {
  GRAPHIC_UNICODE as ZX80_GRAPHICS,
  ESCAPES as ZX80_ESCAPES,
} from './zx80/charset';

/**
 * Re-derive the Sinclair block-graphics unicode tables from the real ROM
 * character generators, so the glyph we show for a code is the shape the
 * machine actually draws rather than something copied from a manual.
 *
 * Both machines store 64 8x8 bitmaps (codes 0x00-0x3F); inverse video is done
 * in hardware by complementing the bitmap, so codes 0x80+ are computed here the
 * same way the display does it. Each cell is read as four 4x4 quadrants, every
 * one of which is blank, solid, or one of the two phases of the chequer dither
 * the ROM uses for its "grey" cells. That quadrant signature is what selects
 * the unicode character - Block Elements for the solid quadrant shapes, Symbols
 * for Legacy Computing (U+1FB8E-U+1FB92) for the chequered ones.
 */

const ROMS = {
  zx81: {
    file: 'zx81.rom',
    fontBase: 0x1e00,
    table: ZX81_GRAPHICS,
    escapes: ZX81_ESCAPES,
  },
  zx80: {
    file: 'zx80.rom',
    fontBase: 0x0e00,
    table: ZX80_GRAPHICS,
    escapes: ZX80_ESCAPES,
  },
} as const;

type Quadrant = 'blank' | 'solid' | 'chequer' | 'chequerInverse';

/** The 8 rows of a code's bitmap, inverting in hardware for codes 0x80+. */
function bitmap(rom: Uint8Array, fontBase: number, code: number): number[] {
  const base = fontBase + (code & 0x3f) * 8;
  const rows = [...rom.subarray(base, base + 8)];
  return code & 0x80 ? rows.map((r) => ~r & 0xff) : rows;
}

/**
 * Classify one 4x4 quadrant of a cell, or null when it is none of the four -
 * the punctuation and letter codes interleaved with the graphics draw shapes
 * no block character can express.
 */
function quadrant(
  rows: number[],
  top: boolean,
  left: boolean,
): Quadrant | null {
  const rowRange = top ? [0, 1, 2, 3] : [4, 5, 6, 7];
  const colRange = left ? [0, 1, 2, 3] : [4, 5, 6, 7];
  let solid = true;
  let blank = true;
  let chequer = true;
  let chequerInverse = true;
  for (const r of rowRange) {
    for (const c of colRange) {
      const on = (rows[r]! & (1 << (7 - c))) !== 0;
      if (on) blank = false;
      else solid = false;
      // The ROM's dither alternates on (row + column) parity; the inverse
      // phase is what appears inside an inverse-video cell.
      if (on !== ((r + c) % 2 === 0)) chequer = false;
      if (on !== ((r + c) % 2 !== 0)) chequerInverse = false;
    }
  }
  if (blank) return 'blank';
  if (solid) return 'solid';
  if (chequer) return 'chequer';
  if (chequerInverse) return 'chequerInverse';
  return null;
}

/** Quadrant signature of a cell, or null if it is not a block shape at all. */
function signature(rows: number[]): string | null {
  const quads = [
    quadrant(rows, true, true),
    quadrant(rows, true, false),
    quadrant(rows, false, true),
    quadrant(rows, false, false),
  ];
  return quads.every((q) => q !== null) ? quads.join('|') : null;
}

const B = 'blank';
const S = 'solid';
const C = 'chequer';
const I = 'chequerInverse';

/**
 * Quadrant signature -> the unicode character that draws that shape. The solid
 * combinations are the 16 Block Elements quadrants; the chequered ones are the
 * Legacy Computing shades, named here as unicode names them.
 */
const SHAPES: Record<string, string> = {
  [[B, B, B, B].join('|')]: ' ',
  [[S, B, B, B].join('|')]: '▘',
  [[B, S, B, B].join('|')]: '▝',
  [[S, S, B, B].join('|')]: '▀',
  [[B, B, S, B].join('|')]: '▖',
  [[S, B, S, B].join('|')]: '▌',
  [[B, S, S, B].join('|')]: '▞',
  [[S, S, S, B].join('|')]: '▛',
  [[B, B, B, S].join('|')]: '▗',
  [[S, B, B, S].join('|')]: '▚',
  [[B, S, B, S].join('|')]: '▐',
  [[S, S, B, S].join('|')]: '▜',
  [[B, B, S, S].join('|')]: '▄',
  [[S, B, S, S].join('|')]: '▙',
  [[B, S, S, S].join('|')]: '▟',
  [[S, S, S, S].join('|')]: '█',
  [[C, C, C, C].join('|')]: '▒', // U+2592 medium shade
  [[I, I, I, I].join('|')]: '\u{1FB90}', // inverse medium shade
  [[C, C, B, B].join('|')]: '\u{1FB8E}', // upper half medium shade
  [[B, B, C, C].join('|')]: '\u{1FB8F}', // lower half medium shade
  [[S, S, I, I].join('|')]: '\u{1FB91}', // upper half block, lower half inverse medium shade
  [[I, I, S, S].join('|')]: '\u{1FB92}', // upper half inverse medium shade, lower half block
};

describe.each(Object.entries(ROMS))(
  'Sinclair block graphics from the %s ROM font',
  (_id, { file, fontBase, table, escapes }) => {
    const rom = new Uint8Array(
      readFileSync(join(__dirname, '../../public/roms', file)),
    );

    it('draws every mapped code as the character the table claims', () => {
      for (const [key, glyph] of Object.entries(table)) {
        const code = Number(key);
        const shape = signature(bitmap(rom, fontBase, code));
        expect(
          shape,
          `0x${code.toString(16)} is mapped to ${glyph} but the ROM does not draw a block shape there`,
        ).not.toBeNull();
        const expected = SHAPES[shape!];
        expect(
          expected,
          `0x${code.toString(16)} draws a shape with no unicode character (${shape})`,
        ).toBeDefined();
        expect(expected, `0x${code.toString(16)}`).toBe(glyph);
      }
    });

    it('maps every code whose shape unicode can express', () => {
      // The complement of the table: any code the ROM draws as one of the
      // known shapes must appear in GRAPHIC_UNICODE, so a graphics character
      // cannot quietly stay stuck on an escape spelling. SPACE is the one
      // exception - it is ordinary punctuation, not a graphic.
      for (const code of [
        ...Array.from({ length: 0x0c }, (_, i) => i),
        ...Array.from({ length: 0x0c }, (_, i) => 0x80 | i),
      ]) {
        const shape = signature(bitmap(rom, fontBase, code));
        if (shape === null) continue;
        const expected = SHAPES[shape];
        if (expected === undefined || expected === ' ') continue;
        expect(
          table[code],
          `0x${code.toString(16)} draws ${expected} but is not in GRAPHIC_UNICODE`,
        ).toBe(expected);
      }
    });

    it('spells each escape for the shape it names', () => {
      // The two-character escapes describe the cell: ' = upper, . = lower,
      // : = full, space = empty, ! = chequered, | = inverse chequered. The
      // half-cell greys on the ZX81 used to be the wrong way round, so check
      // the spelling against the shape the ROM actually draws.
      const HALVES: Record<string, [string, string]> = {
        "!'": ['chequer', 'blank'],
        '!.': ['blank', 'chequer'],
        "|'": ['chequerInverse', 'solid'],
        '|.': ['solid', 'chequerInverse'],
        '!!': ['chequer', 'chequer'],
        '||': ['chequerInverse', 'chequerInverse'],
      };
      for (const [spelling, [upper, lower]] of Object.entries(HALVES)) {
        const code = escapes[spelling as keyof typeof escapes];
        expect(code, `\\${spelling} is not an escape here`).toBeDefined();
        expect(signature(bitmap(rom, fontBase, code)), `\\${spelling}`).toBe(
          [upper, upper, lower, lower].join('|'),
        );
      }
    });

    it('gives each mapped code a distinct character', () => {
      const seen = new Map<string, number>();
      for (const [key, glyph] of Object.entries(table)) {
        const clash = seen.get(glyph);
        expect(
          clash,
          `0x${key} and 0x${clash?.toString(16)} both map to ${glyph}`,
        ).toBeUndefined();
        seen.set(glyph, Number(key));
      }
    });
  },
);
