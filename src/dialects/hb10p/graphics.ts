// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { GraphicEntry } from '../../keyboard/layoutSchema';
import { hb10pCharset } from './charset';

/**
 * The machine's block and box graphics: one entry per character, carrying the
 * keycap it is printed on, the GRAPH combination that reaches it, the text it
 * inserts and the byte that text stands for.
 *
 * Read by both the keyboard palette and the charset, so the legends and the
 * byte mapping cannot drift apart: `char` is asked of the charset rather than
 * spelled out here, so a shape can only be written down once.
 *
 * The combinations are the BIOS's own. Its key-decoding tables sit at 0x0DA5
 * in this ROM, one 48-byte table per modifier state indexed by
 * (matrix row x 8 + bit) over rows 0-5: unshifted, shifted, GRAPH,
 * GRAPH+SHIFT, CODE, CODE+SHIFT. The two GRAPH tables are transcribed below
 * and `keyboardLayout.test.ts` reads them back out of the ROM to check it.
 *
 * The MSX prints these on the front faces of its keycaps, so every cell names
 * the key it is on; a machine that printed nothing would have to label its
 * cells with codes instead. Three codes inside the graphics range are not
 * here - 0xD8, 0xD9 and 0xDA, the Greek delta, the double dagger and omega -
 * because they are not block graphics and the machine reaches them with CODE
 * rather than GRAPH.
 */

/** [character code, keycap, modifier] - the GRAPH tables, sorted by code. */
const TABLE: [number, string, 'GRAPH' | 'GRAPH+SHIFT'][] = [
  [0xc0, 'U', 'GRAPH'],
  [0xc1, 'D', 'GRAPH+SHIFT'],
  [0xc2, 'O', 'GRAPH'],
  [0xc3, 'O', 'GRAPH+SHIFT'],
  [0xc4, 'A', 'GRAPH'],
  [0xc5, 'U', 'GRAPH+SHIFT'],
  [0xc6, 'J', 'GRAPH'],
  [0xc7, 'D', 'GRAPH'],
  [0xc8, 'L', 'GRAPH'],
  [0xc9, 'L', 'GRAPH+SHIFT'],
  [0xca, 'J', 'GRAPH+SHIFT'],
  [0xcb, 'Q', 'GRAPH+SHIFT'],
  [0xcc, 'Q', 'GRAPH'],
  [0xcd, 'E', 'GRAPH'],
  [0xce, 'E', 'GRAPH+SHIFT'],
  [0xcf, 'W', 'GRAPH'],
  [0xd0, 'W', 'GRAPH+SHIFT'],
  [0xd1, 'S', 'GRAPH+SHIFT'],
  [0xd2, 'S', 'GRAPH'],
  [0xd3, 'N', 'GRAPH+SHIFT'],
  [0xd4, 'F', 'GRAPH+SHIFT'],
  [0xd5, 'V', 'GRAPH+SHIFT'],
  [0xd6, 'H', 'GRAPH+SHIFT'],
  [0xd7, 'P', 'GRAPH+SHIFT'],
  [0xdb, 'P', 'GRAPH'],
  [0xdc, 'I', 'GRAPH'],
  [0xdd, 'K', 'GRAPH'],
  [0xde, 'K', 'GRAPH+SHIFT'],
  [0xdf, 'I', 'GRAPH+SHIFT'],
];

const entries = (modifier: 'GRAPH' | 'GRAPH+SHIFT'): GraphicEntry[] =>
  TABLE.filter(([, , m]) => m === modifier).map(([code, key]) => ({
    key,
    modifier,
    char: hb10pCharset.glyph(code),
    code,
  }));

/** The bars, quadrants and dithers GRAPH alone reaches. */
export const HB10P_GRAPH_GRAPHICS: GraphicEntry[] = entries('GRAPH');

/** Their partners, on the same keycaps with SHIFT held as well. */
export const HB10P_GRAPH_SHIFT_GRAPHICS: GraphicEntry[] =
  entries('GRAPH+SHIFT');

/** Both sets, in code order - what the charset and the audit read. */
export const hb10pGraphics: GraphicEntry[] = TABLE.map(
  ([code, key, modifier]) => ({
    key,
    modifier,
    char: hb10pCharset.glyph(code),
    code,
  }),
);
