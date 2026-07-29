import type { GraphicEntry } from '../../keyboard/layoutSchema';
import { mosaicChar } from './charset';

/**
 * The BBC's MODE 7 mosaic graphics, as the palette offers them. Shared by the
 * BBC Micro and the BBC Master, whose character sets are the same.
 *
 * **The machine has no graphics keys.** No BBC keycap prints a graphic; a
 * program reached the mosaics with `PRINT CHR$(n)` after a graphics-colour
 * control code (or by poking teletext screen memory). So each entry carries no
 * `key` and the palette labels its cells with the character code instead -
 * the number the user would have typed into `CHR$` on the real machine.
 *
 * The two sections are the two top-bit mosaic banks, in code order: the
 * SAA5050 draws a code as a mosaic iff bit 5 is set, so the capitals
 * 0xC0–0xDF sit between the banks and blast through as letters. 0xA0 is left
 * out: it is the blank cell, and `bbcmicro/charset.ts` spells it `{0xA0}`
 * rather than a space so it cannot collide with ASCII SPACE - so there is no
 * character for a cell to insert, exactly as on the Spectrum.
 *
 * The characters come from the charset's own `mosaicChar`, so the palette and
 * the mapping cannot drift apart.
 */

/** Codes FROM..TO that have a character, as palette entries. */
function entries(from: number, to: number): GraphicEntry[] {
  const out: GraphicEntry[] = [];
  for (let code = from; code <= to; code++) {
    const char = mosaicChar(code);
    if (char !== undefined) out.push({ char, code });
  }
  return out;
}

export const BBC_LOW_MOSAICS: GraphicEntry[] = entries(0xa1, 0xbf);
export const BBC_HIGH_MOSAICS: GraphicEntry[] = entries(0xe0, 0xff);

/** Every section in code order, for the round-trip and layout tests. */
export const BBC_GRAPHICS: GraphicEntry[] = [
  ...BBC_LOW_MOSAICS,
  ...BBC_HIGH_MOSAICS,
];
