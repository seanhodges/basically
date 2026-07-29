/**
 * The Unicode spelling of a 2×3 block-graphics cell, shared by the machines
 * that draw them: the TRS-80's 0x80-based graphics and the BBC's SAA5050
 * MODE 7 mosaics (which arrive with a permuted bit order the BBC charset
 * unpermutes before calling in here).
 *
 * A pattern is a six-bit bitmap of the sub-cells - bit 0 top-left, bit 1
 * top-right, bit 2 mid-left, bit 3 mid-right, bit 4 bottom-left, bit 5
 * bottom-right. Unicode's "Symbols for Legacy Computing" block enumerates the
 * shapes at U+1FB00… in that same ascending bit order, minus the four patterns
 * older blocks already cover: blank (SPACE), the left and right half blocks and
 * the full block.
 */

const SEXTANT_BASE = 0x1fb00;
// The four sextant patterns Unicode covers outside the U+1FB00 block.
const SEXTANT_SPECIAL: Record<number, string> = {
  0x00: ' ', // blank
  0x15: '▌', // 0b010101 left half  -> U+258C
  0x2a: '▐', // 0b101010 right half -> U+2590
  0x3f: '█', // full block          -> U+2588
};

/** Block-graphics pattern (0..63) -> Unicode glyph. */
export function sextantGlyph(pattern: number): string {
  const special = SEXTANT_SPECIAL[pattern];
  if (special !== undefined) return special;
  // U+1FB00 enumerates the 60 remaining patterns in ascending bit order,
  // skipping the four that already have characters (0, 0x15, 0x2A, 0x3F).
  let index = pattern - 1; // pattern 0 isn't in the block
  if (pattern > 0x15) index--;
  if (pattern > 0x2a) index--;
  return String.fromCodePoint(SEXTANT_BASE + index);
}
