import type { GraphicEntry } from '../../keyboard/layoutSchema';
import { GRAPHIC_UNICODE } from './charset';

/**
 * The ZX80's block graphics and the keys they live on.
 *
 * The shapes, and the keys carrying them, are the ZX81's (the ZX80 keyboard
 * prints the same twenty graphics on 1-8, Q-Y and A-H, with the solid block on
 * SPACE); only the byte behind each one differs, because the ZX80 charset packs
 * its graphics into a different range. Those codes come from the charset's
 * {@link GRAPHIC_UNICODE}, so the palette and the charset cannot disagree.
 */

/** Key id (as printed on the keycap) -> the graphics code it types. */
const KEY_CODES: Array<[key: string, code: number]> = [
  ['1', 0x04],
  ['2', 0x05],
  ['3', 0x07],
  ['4', 0x06],
  ['5', 0x02],
  ['6', 0x03],
  ['7', 0x83],
  ['8', 0x82],
  ['Q', 0x84],
  ['W', 0x85],
  ['E', 0x86],
  ['R', 0x87],
  ['T', 0x08],
  ['Y', 0x88],
  ['A', 0x09],
  ['S', 0x0b],
  ['D', 0x0a],
  ['F', 0x8b],
  ['G', 0x8a],
  ['H', 0x89],
  ['SPACE', 0x80],
];

export const ZX80_GRAPHICS: GraphicEntry[] = KEY_CODES.map(([key, code]) => {
  const char = GRAPHIC_UNICODE[code];
  if (char === undefined)
    throw new Error(
      `ZX80 key ${key} names unmapped code 0x${code.toString(16)}`,
    );
  return { key, char, code };
});
