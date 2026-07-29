import type { GraphicEntry } from '../../keyboard/layoutSchema';
import { sextantChar } from './charset';

/**
 * The Atom's MC6847 Semigraphics-6 cells, as the palette offers them.
 *
 * **The machine has no graphics keys, and no `CHR$` either.** No Atom keycap
 * prints a graphic, and Atom BASIC has no character function to reach one with
 * - a program put the byte straight into a string literal (or poked screen
 * memory). So each entry carries no `key`, and the cell is labelled with the
 * character code, which is the only thing there is to teach.
 *
 * One section: the kernel maps program bytes 0xA0–0xDF onto the 64 patterns in
 * order, so byte order is pattern order. 0xA0 is left out - it is the blank
 * cell, and `charset.ts` spells it `{0xA0}` rather than a space so it cannot
 * collide with ASCII SPACE, so there is no character for a cell to insert
 * (the same gap the Spectrum, TRS-80, CPC and BBC blanks have).
 *
 * The characters come from the charset's own `sextantChar`, so the palette and
 * the mapping cannot drift apart.
 */

/** Codes FROM..TO that have a character, as palette entries. */
function entries(from: number, to: number): GraphicEntry[] {
  const out: GraphicEntry[] = [];
  for (let code = from; code <= to; code++) {
    const char = sextantChar(code);
    if (char !== undefined) out.push({ char, code });
  }
  return out;
}

export const ATOM_GRAPHICS: GraphicEntry[] = entries(0xa1, 0xdf);
