import { CharsetError, type CharsetMapping } from '../types';

/**
 * TRS-80 character set <-> editor text, for the bytes a Level II BASIC
 * program stores: string literals, REM/DATA text and any non-keyword character.
 *
 *  - 0x20–0x7F is ASCII. The TRS-80 has no lower case (a hardware quirk forces
 *    letters to upper case), so {@link toMachine} folds a–z onto A–Z. The
 *    0x60–0x7F codes still map straight through for completeness even though the
 *    video hardware would show them upper-cased.
 *  - 0x80–0xBF are the 2×3 block-graphics cells: the low 6 bits are a bitmap of
 *    the six sub-cells (bit0 top-left, bit1 top-right, bit2 mid-left, bit3
 *    mid-right, bit4 bottom-left, bit5 bottom-right). They map to the Unicode
 *    "Symbols for Legacy Computing" sextants (U+1FB00…), with SPACE, the two
 *    half-blocks and the full block standing in for the four patterns Unicode
 *    gives dedicated characters.
 *  - 0xC0–0xFF repeat the graphics patterns (the top two address bits are
 *    ignored by the character generator); they decode the same as 0x80–0xBF.
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
function sextantGlyph(pattern: number): string {
  const special = SEXTANT_SPECIAL[pattern];
  if (special !== undefined) return special;
  // U+1FB00 enumerates the 60 remaining patterns in ascending bit order,
  // skipping the four that already have characters (0, 0x15, 0x2A, 0x3F).
  let index = pattern - 1; // pattern 0 isn't in the block
  if (pattern > 0x15) index--;
  if (pattern > 0x2a) index--;
  return String.fromCodePoint(SEXTANT_BASE + index);
}

// Build the forward map (Unicode glyph -> 0x80-based machine code) once.
const GLYPH_TO_CODE = new Map<string, number>();
for (let pattern = 1; pattern < 64; pattern++) {
  // Skip the blank: SPACE is ASCII 0x20 and must not resolve to a graphics code.
  const glyph = sextantGlyph(pattern);
  if (!GLYPH_TO_CODE.has(glyph)) GLYPH_TO_CODE.set(glyph, 0x80 | pattern);
}

function charToCode(ch: string): number | undefined {
  const graphic = GLYPH_TO_CODE.get(ch);
  if (graphic !== undefined) return graphic;

  let code = ch.charCodeAt(0);
  // Fold lower case onto the upper-case codes the Model I actually displays.
  if (code >= 0x61 && code <= 0x7a) code -= 0x20;
  if (code >= 0x20 && code <= 0x7f) return code;
  return undefined;
}

export const trs80Charset: CharsetMapping = {
  toMachine(text: string): Uint8Array {
    // Iterate by code point: the block-graphics sextants live in the astral
    // plane (U+1FB00…), so a per-code-unit loop would split their surrogates.
    const chars = Array.from(text);
    const out = new Uint8Array(chars.length);
    for (let i = 0; i < chars.length; i++) {
      const code = charToCode(chars[i]!);
      if (code === undefined) {
        throw new CharsetError(
          `Character ${JSON.stringify(chars[i])} has no TRS-80 equivalent`,
          i,
        );
      }
      out[i] = code;
    }
    return out;
  },

  toUnicode(codes: ArrayLike<number>): string {
    let text = '';
    for (let i = 0; i < codes.length; i++) {
      text += this.glyph(codes[i]!);
    }
    return text;
  },

  glyph(code: number): string {
    const c = code & 0xff;
    // 0x80-0xFF: block graphics (the top two bits are ignored by the hardware).
    if (c >= 0x80) return sextantGlyph(c & 0x3f);
    if (c >= 0x20 && c <= 0x7f) return String.fromCharCode(c);
    return ' ';
  },
};
