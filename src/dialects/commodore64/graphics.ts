/**
 * Commodore 64 keyboard block-graphics - the two PETSCII graphics printed on the
 * front face of each letter key:
 *  - the **C= (Commodore) set** (left front face), and
 *  - the **SHIFT set** (right front face).
 *
 * This is the single source of truth shared by the virtual keyboard (which shows
 * the glyph and inserts `char` into the editor) and the charset (which maps
 * `char` <-> `petscii` so a program containing one still tokenizes). Keeping both
 * here stops the keyboard legends and the charset drifting apart.
 *
 * `char` is the closest-unicode rendering of the C64 font glyph (taken from
 * `src/emulator/c64/viciious/tools/c64FontCodePoints.js`); `petscii` is the byte
 * the key produces in a string literal, so the running machine renders the same
 * glyph. A handful of font glyphs (line/bar positions) collapse onto the same
 * unicode char; the reverse `petscii -> char` is still unique, and the forward
 * `char -> petscii` simply keeps the first registered code (cosmetically
 * identical line graphics).
 */

export interface C64GraphicEntry {
  /** Matrix key token (also the layout key id), e.g. 'A'. */
  key: string;
  char: string;
  petscii: number;
}

/** Per-letter [C= char, C= petscii, SHIFT char, SHIFT petscii]. */
const LETTERS: Array<[string, string, number, string, number]> = [
  ['A', '┌', 0xb0, '♠', 0xc1],
  ['B', '▚', 0xbf, '│', 0xc2],
  ['C', '▝', 0xbc, '─', 0xc3],
  ['D', '▗', 0xac, '─', 0xc4],
  ['E', '┴', 0xb1, '▔', 0xc5],
  ['F', '▖', 0xbb, '─', 0xc6],
  ['G', '▎', 0xa5, '│', 0xc7],
  ['H', '▎', 0xb4, '│', 0xc8],
  ['I', '▄', 0xa2, '╮', 0xc9],
  ['J', '▍', 0xb5, '╰', 0xca],
  ['K', '▌', 0xa1, '╯', 0xcb],
  ['L', '▕', 0xb6, '⌞', 0xcc],
  ['M', '▕', 0xa7, '╲', 0xcd],
  ['N', '▕', 0xaa, '╱', 0xce],
  ['O', '▃', 0xb9, '⌜', 0xcf],
  ['P', '▂', 0xaf, '⌝', 0xd0],
  ['Q', '├', 0xab, '●', 0xd1],
  ['R', '┬', 0xb2, '_', 0xd2],
  ['S', '┐', 0xae, '♥', 0xd3],
  ['T', '▔', 0xa3, '▎', 0xd4],
  ['U', '▔', 0xb8, '╭', 0xd5],
  ['V', '▘', 0xbe, '╳', 0xd6],
  ['W', '┤', 0xb3, '○', 0xd7],
  ['X', '┘', 0xbd, '♣', 0xd8],
  ['Y', '▔', 0xb7, '▕', 0xd9],
  ['Z', '└', 0xad, '♦', 0xda],
];

/** C= (Commodore) graphics, one per letter key. */
export const C64_COMMODORE_GRAPHICS: C64GraphicEntry[] = LETTERS.map(
  ([key, char, petscii]) => ({ key, char, petscii }),
);

/** SHIFT graphics, one per letter key. */
export const C64_SHIFT_GRAPHICS: C64GraphicEntry[] = LETTERS.map(
  ([key, , , char, petscii]) => ({ key, char, petscii }),
);

/** Every graphic, both sets, for charset round-tripping. */
export const C64_GRAPHICS: C64GraphicEntry[] = [
  ...C64_COMMODORE_GRAPHICS,
  ...C64_SHIFT_GRAPHICS,
];
