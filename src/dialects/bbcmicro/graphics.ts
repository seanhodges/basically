import type { GraphicEntry } from '../../keyboard/layoutSchema';
import { mosaicChar } from './charset';
import { teletextChip, teletextEscape } from './teletextChips';

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

/** A teletext control code as a palette cell: it inserts its escape, drawn. */
function control(code: number): GraphicEntry {
  return { char: teletextEscape(code), code, chip: teletextChip(code) };
}

/**
 * The graphics-colour codes - the ones that make the mosaics above draw.
 *
 * The SAA5050 starts every screen row in text mode and shows a mosaic byte as
 * a mosaic only while one of these is in force on that row; without one, a
 * mosaic prints as the character its low seven bits name (`CHR$(161)` is `!`).
 * So the palette leads with them: they are a precondition of the section
 * below, not an embellishment of it.
 *
 * The *text* colours `0x81`–`0x87` are deliberately absent. They clear the
 * chip's graphics flag - a cell for them next to the mosaics would offer the
 * user the very thing that stops the mosaics drawing. They still get chips in
 * the editor, where an imported teletext program is full of them.
 */
export const BBC_GRAPHICS_COLOURS: GraphicEntry[] = [
  0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97,
].map(control);

/**
 * Codes that shape mosaics already drawing rather than switching them on:
 * contiguous/separated cells, and holding the last graphic under a following
 * control byte (which is how a teletext line spends a cell on an attribute
 * without punching a hole in the picture).
 */
export const BBC_GRAPHICS_STYLES: GraphicEntry[] = [0x99, 0x9a, 0x9e, 0x9f].map(
  control,
);

/** Every section in palette order, for the round-trip and layout tests. */
export const BBC_GRAPHICS: GraphicEntry[] = [
  ...BBC_GRAPHICS_COLOURS,
  ...BBC_LOW_MOSAICS,
  ...BBC_HIGH_MOSAICS,
  ...BBC_GRAPHICS_STYLES,
];
