// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { GraphicEntry } from '../../keyboard/layoutSchema';
import { plainChar } from './charset';
import { STANDARD_GRAPHICS_FIRST, STANDARD_GRAPHICS_LAST } from './addresses';

/**
 * The Sorcerer's standard graphics set and the keys it is printed on, read by
 * *both* the keyboard layout and the graphics palette so the two cannot drift.
 *
 * The Sorcerer printed its graphics on the front faces of the keycaps, and the
 * Monitor's own keyboard decoder is what turns GRAPHIC + a key into one:
 * pressing GRAPHIC with a key types a code in the standard set (0x80-0xBF),
 * and SHIFT + GRAPHIC types the same key's code 0x40 higher, in the
 * user-definable band - which has no shape until a program pokes one in. So
 * the palette's modifier is GRAPHIC alone.
 *
 * The codes run in *keyboard* order rather than in any order of shape: the
 * number row and the three symbol keys beside it take 0x80-0x8D, the Q row
 * 0x8E-0x99, the A row 0x9A-0xA6, the Z row 0xA7-0xB0, and the numeric keypad
 * 0xB1-0xBF. The table below is that walk, transcribed from what the booted
 * Monitor types for each key rather than from a picture of the keyboard.
 *
 * Two keys are in the walk but not in the palette: SKIP takes 0x8D, which is a
 * small pictorial glyph the charset has no character for (it takes a `{0x8D}`
 * escape), and the keypad's 5 has no graphic at all - it types a plain `5`.
 *
 * The characters come from the charset's own {@link plainChar}, so a palette
 * cell can never show something the tokenizer would not produce.
 */

/** Keycap legend -> the standard-graphics code GRAPHIC + that key types. */
const KEY_CODES: readonly (readonly [key: string, code: number])[] = [
  // The number row, then the three symbol keys that finish it, then SKIP.
  ['1', 0x80],
  ['2', 0x81],
  ['3', 0x82],
  ['4', 0x83],
  ['5', 0x84],
  ['6', 0x85],
  ['7', 0x86],
  ['8', 0x87],
  ['9', 0x88],
  ['0', 0x89],
  [':', 0x8a],
  ['-', 0x8b],
  ['^', 0x8c],
  ['SKIP', 0x8d],
  // The Q row.
  ['Q', 0x8e],
  ['W', 0x8f],
  ['E', 0x90],
  ['R', 0x91],
  ['T', 0x92],
  ['Y', 0x93],
  ['U', 0x94],
  ['I', 0x95],
  ['O', 0x96],
  ['P', 0x97],
  ['[', 0x98],
  [']', 0x99],
  // The A row.
  ['A', 0x9a],
  ['S', 0x9b],
  ['D', 0x9c],
  ['F', 0x9d],
  ['G', 0x9e],
  ['H', 0x9f],
  ['J', 0xa0],
  ['K', 0xa1],
  ['L', 0xa2],
  [';', 0xa3],
  ['@', 0xa4],
  ['\\', 0xa5],
  ['_', 0xa6],
  // The Z row.
  ['Z', 0xa7],
  ['X', 0xa8],
  ['C', 0xa9],
  ['V', 0xaa],
  ['B', 0xab],
  ['N', 0xac],
  ['M', 0xad],
  [',', 0xae],
  ['.', 0xaf],
  ['/', 0xb0],
  // The numeric keypad, whose keys are on the same matrix as the rest.
  ['KP -', 0xb1],
  ['KP 7', 0xb2],
  ['KP 8', 0xb3],
  ['KP 9', 0xb4],
  ['KP /', 0xb5],
  ['KP 4', 0xb6],
  ['KP 6', 0xb7],
  ['KP *', 0xb8],
  ['KP 1', 0xb9],
  ['KP 2', 0xba],
  ['KP 3', 0xbb],
  ['KP +', 0xbc],
  ['KP 0', 0xbd],
  ['KP .', 0xbe],
  ['KP =', 0xbf],
];

/** code -> the key it is printed on. */
const KEY_BY_CODE = new Map(KEY_CODES.map(([key, code]) => [code, key]));

/** One palette cell, or nothing where the charset has no character for the code. */
function entry(code: number): GraphicEntry[] {
  const char = plainChar(code);
  const key = KEY_BY_CODE.get(code);
  if (char === undefined || key === undefined) return [];
  return [{ key, modifier: 'GRAPHIC', char, code }];
}

/** The cells for `codes`, in the order given. */
const entries = (codes: readonly number[]): GraphicEntry[] =>
  codes.flatMap(entry);

/**
 * Lines, corners and junctions: the family drawn on the cell's centre row and
 * centre column, which is what makes them join up across neighbouring cells.
 */
export const SORCERER_LINE_GRAPHICS: GraphicEntry[] = entries([
  0x97, 0xa2, 0xad, 0xb2, 0xb4, 0xb9, 0xbb, 0xbc, 0xbd, 0xbe, 0xbf, 0x8f, 0x90,
  0x9a, 0x9b, 0xab, 0xac, 0x8e,
]);

/**
 * The one-dot rules: a single lit row or column, at each of the eight
 * positions across and down the cell, plus the four that turn a corner. These
 * are what the machine drew fine grids and sliders with.
 */
export const SORCERER_RULE_GRAPHICS: GraphicEntry[] = entries([
  0x80, 0x81, 0x82, 0x83, 0x85, 0x86, 0x87, 0x89, 0x8a, 0x8b, 0x8c, 0xae, 0xaf,
  0xb0, 0x91, 0x92, 0x9c, 0x9d,
]);

/** Blocks, shades and the pictorial shapes - discs, triangles and card suits. */
export const SORCERER_BLOCK_GRAPHICS: GraphicEntry[] = entries([
  0xa7, 0xa8, 0xa9, 0xaa, 0x95, 0x96, 0xa0, 0xa1, 0xa5, 0xa6, 0xb3, 0xb6, 0xb7,
  0xba, 0xb1, 0xb5, 0xb8, 0x93, 0x94, 0x9e, 0x9f, 0x84, 0x88, 0x98, 0x99, 0xa3,
  0xa4,
]);

/**
 * Every cell the palette offers, in one list - the three sections above
 * flattened, for the tests that ask what the whole set is.
 */
export const sorcererGraphics: readonly GraphicEntry[] = [
  ...SORCERER_LINE_GRAPHICS,
  ...SORCERER_RULE_GRAPHICS,
  ...SORCERER_BLOCK_GRAPHICS,
];

/** The band the palette draws from, for the completeness check beside it. */
export const SORCERER_GRAPHICS_BAND = {
  first: STANDARD_GRAPHICS_FIRST,
  last: STANDARD_GRAPHICS_LAST,
} as const;
