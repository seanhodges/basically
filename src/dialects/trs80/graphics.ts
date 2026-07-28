import type { GraphicEntry } from '../../keyboard/layoutSchema';
import { plainChar } from './charset';

/**
 * The TRS-80's block graphics, as the palette offers them.
 *
 * **The machine has no graphics keys.** The Model I and III keyboards print
 * nothing but letters, digits and punctuation; a program reached the block
 * graphics through `PRINT CHR$(n)` (or `SET`/`RESET` on the 128x48 grid the
 * codes stand for). So each entry carries no `key` and the palette labels its
 * cells with the character code instead - the number the user would have typed
 * into `CHR$` on the real machine.
 *
 * Codes 0x81-0xBF are the 2x3 cells: the low six bits are a bitmap of the
 * sub-cells, bit 0 top-left through bit 5 bottom-right. Listing them in code
 * order therefore walks that bit pattern in binary, which is the order the
 * machine's own numbering implies.
 *
 * 0x80 is left out. It is the blank cell, and `trs80/charset.ts` spells it
 * `{0x80}` rather than a space so it cannot collide with ASCII SPACE - so
 * there is no character for a cell to insert, exactly as on the Spectrum.
 *
 * The characters come from the charset's own `plainChar`, so the palette and
 * the mapping cannot drift apart.
 */

/** The first and last block-graphics codes with a character of their own. */
const FIRST = 0x81;
const LAST = 0xbf;

export const TRS80_GRAPHICS: GraphicEntry[] = Array.from(
  { length: LAST - FIRST + 1 },
  (_, i) => {
    const code = FIRST + i;
    const char = plainChar(code);
    if (char === undefined)
      throw new Error(`TRS-80 graphics code 0x${code.toString(16)} has no glyph`); // prettier-ignore
    return { char, code };
  },
);
