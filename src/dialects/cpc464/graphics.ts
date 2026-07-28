import type { GraphicEntry } from '../../keyboard/layoutSchema';
import { CPC_GLYPHS } from './charset';

/**
 * The Amstrad CPC's block graphics, as the palette offers them. Shared by the
 * CPC 464 and the 6128, whose character sets are the same.
 *
 * **The machine has no graphics keys.** Its keycaps print nothing but letters,
 * digits and punctuation, and the firmware's key translation tables map no key
 * - plain, shifted or with CONTROL - to a code in the graphics range: CONTROL
 * produces the 0x00-0x1F control codes, and the only upper-range codes a key
 * emits are the cursor arrows at 0xF0-0xF3, which are outside the graphics
 * block. A program reached these characters with `PRINT CHR$(n)`. So each entry
 * carries no `key` and the palette labels its cells with the character code
 * instead.
 *
 * The three sections follow the firmware's own grouping of the range:
 *
 *  - **0x81-0x8F** the 2x2 quadrant mosaics (bit 0 top-left … bit 3
 *    bottom-right).
 *  - **0x90-0x9F** the dot and box-drawing segments.
 *  - **0xC0-0xDF** the diamond edges, diagonals, shades and eighth blocks.
 *
 * 0x80 is left out: it draws a blank cell, and the charset spells it `{0x80}`
 * rather than a space so it cannot collide with ASCII SPACE, so there is no
 * character for a cell to insert. Every other code in the machine's graphics
 * range has one.
 *
 * The characters come from `CPC_GLYPHS`, so the palette and the charset cannot
 * drift apart.
 */

/** Codes FROM..TO that have a character, as palette entries. */
function entries(from: number, to: number): GraphicEntry[] {
  const out: GraphicEntry[] = [];
  for (let code = from; code <= to; code++) {
    const char = CPC_GLYPHS[code];
    if (char !== undefined) out.push({ char, code });
  }
  return out;
}

export const CPC_MOSAIC_GRAPHICS: GraphicEntry[] = entries(0x80, 0x8f);
export const CPC_LINE_GRAPHICS: GraphicEntry[] = entries(0x90, 0x9f);
export const CPC_SHADE_GRAPHICS: GraphicEntry[] = entries(0xc0, 0xdf);

/** Every section in code order, for the round-trip and layout tests. */
export const CPC_GRAPHICS: GraphicEntry[] = [
  ...CPC_MOSAIC_GRAPHICS,
  ...CPC_LINE_GRAPHICS,
  ...CPC_SHADE_GRAPHICS,
];
