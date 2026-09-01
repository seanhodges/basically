import type { GraphicEntry } from '../../keyboard/layoutSchema';

/**
 * The machine's block graphics and user-defined graphics, read by both the
 * keyboard palette and the charset so the legends and the byte mapping cannot
 * drift apart.
 */

/**
 * Codes 0x80-0x8F draw a 2x2 block, and which quadrant each bit lights is
 * decoded from the ROM rather than read off a keycap.
 *
 * `POUDG` (tprint.asm) passes the low nibble to `QUADBITS`, which doubles every
 * bit of the byte into a sixteen-bit register twice over; the routine then
 * draws four scans of the low result byte and four of the high one. Working the
 * two doublings through leaves the top four scans as bit 1 on the left and bit 0
 * on the right, and the bottom four as bit 3 on the left and bit 2 on the right:
 *
 *     bit 1 = top left      bit 0 = top right
 *     bit 3 = bottom left   bit 2 = bottom right
 *
 * That is *not* the Sinclair order, which lights the quadrants in reading order
 * (0,1,2,3) - the SAM swaps the two bits within each row. 0x80 is blank and
 * 0x8F solid either way, which is why the difference is easy to miss.
 */
const QUADRANT_BITS = {
  topLeft: 0x2,
  topRight: 0x1,
  bottomLeft: 0x8,
  bottomRight: 0x4,
};

/** First block-graphics code; the low nibble carries the quadrants. */
export const BLOCK_FIRST = 0x80;
export const BLOCK_LAST = 0x8f;

/** Unicode block element for each combination, keyed by quadrant set. */
const BLOCK_ELEMENTS: Record<string, string> = {
  '': ' ',
  T: '▘',
  t: '▝',
  Tt: '▀',
  B: '▖',
  TB: '▌',
  tB: '▞',
  TtB: '▛',
  b: '▗',
  Tb: '▚',
  tb: '▐',
  Ttb: '▜',
  Bb: '▄',
  TBb: '▙',
  tBb: '▟',
  TtBb: '█',
};

function blockElement(nibble: number): string {
  const key =
    (nibble & QUADRANT_BITS.topLeft ? 'T' : '') +
    (nibble & QUADRANT_BITS.topRight ? 't' : '') +
    (nibble & QUADRANT_BITS.bottomLeft ? 'B' : '') +
    (nibble & QUADRANT_BITS.bottomRight ? 'b' : '');
  return BLOCK_ELEMENTS[key]!;
}

/**
 * The sixteen block graphics, 0x80-0x8F.
 *
 * No cell carries a `key`. The SAM prints its keyword faces on the keycaps, not
 * its graphics: typed at the machine, SYMBOL + 1-8 gives 0x81-0x87 and 0x80 and
 * CONTROL + SYMBOL + 1-8 the complementary eight, but only inside a string -
 * outside one the same bytes are keyword tokens, so the keycap shows the
 * keyword. The cell's own label is therefore the character code, which is what
 * `CHR$` takes.
 */
export const SAMCOUPE_BLOCK_GRAPHICS: GraphicEntry[] = Array.from(
  { length: BLOCK_LAST - BLOCK_FIRST + 1 },
  (_, n) => ({ code: BLOCK_FIRST + n, char: blockElement(n) }),
);

/** Code -> block element, the form the charset indexes. */
export const BLOCK_GRAPHIC_UNICODE: Record<number, string> = Object.fromEntries(
  SAMCOUPE_BLOCK_GRAPHICS.map((g) => [g.code, g.char]),
);

/**
 * The twenty-five user-defined graphics, 0x90-0xA8.
 *
 * `UDG` in the ROM's system variables points at code 0x90, which is UDG "A", so
 * the codes run A to Y. A UDG's shape is whatever the program pokes into UDG
 * RAM, so what identifies it is its letter: each is written as the squared
 * capital of that letter, the spelling the Sinclair machines already use for
 * the same idea.
 */
export const UDG_FIRST = 0x90;
export const UDG_LAST = 0xa8;

export const SAMCOUPE_UDG_GRAPHICS: GraphicEntry[] = Array.from(
  { length: UDG_LAST - UDG_FIRST + 1 },
  (_, i) => ({
    code: UDG_FIRST + i,
    // U+1F130 SQUARED LATIN CAPITAL LETTER A, through U+1F148 for Y.
    char: String.fromCodePoint(0x1f130 + i),
  }),
);

export const UDG_UNICODE: Record<number, string> = Object.fromEntries(
  SAMCOUPE_UDG_GRAPHICS.map((g) => [g.code, g.char]),
);

/** The letter a UDG code is named for, e.g. 0x90 -> 'A'. */
export function udgLetter(code: number): string {
  return String.fromCharCode(65 + code - UDG_FIRST);
}
