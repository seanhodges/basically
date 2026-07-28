import type { GraphicEntry } from '../../keyboard/layoutSchema';
import { GRAPHIC_UNICODE } from './charset';

/**
 * The ZX81's block graphics and the keys they live on.
 *
 * The machine prints twenty graphic shapes on the tops of keys 1-8, Q-Y and
 * A-H; SHIFT+9 puts the cursor into graphics mode, and pressing one of those
 * keys then types its shape (SPACE types the inverse space, the solid block).
 * The other eleven codes of the graphics range are the inverse-video twins of
 * those shapes, which is why twenty keys reach all twenty-one codes: the
 * inverses are printed on keys of their own rather than reached with SHIFT.
 *
 * Read by the keyboard's graphics palette (which inserts `char`) and by the
 * round-trip test (which checks `char` encodes back to `code`). The characters
 * themselves come from the charset's {@link GRAPHIC_UNICODE}, so the palette
 * cannot show something the charset would not produce.
 */

/** Key id (as printed on the keycap) -> the graphics code it types. */
const KEY_CODES: Array<[key: string, code: number]> = [
  ['1', 0x01],
  ['2', 0x02],
  ['3', 0x87],
  ['4', 0x04],
  ['5', 0x05],
  ['6', 0x83],
  ['7', 0x03],
  ['8', 0x85],
  ['Q', 0x81],
  ['W', 0x82],
  ['E', 0x84],
  ['R', 0x07],
  ['T', 0x06],
  ['Y', 0x86],
  ['A', 0x08],
  ['S', 0x0a],
  ['D', 0x09],
  ['F', 0x8a],
  ['G', 0x89],
  ['H', 0x88],
  ['SPACE', 0x80],
];

export const ZX81_GRAPHICS: GraphicEntry[] = KEY_CODES.map(([key, code]) => {
  const char = GRAPHIC_UNICODE[code];
  if (char === undefined)
    throw new Error(
      `ZX81 key ${key} names unmapped code 0x${code.toString(16)}`,
    );
  return { key, char, code };
});
