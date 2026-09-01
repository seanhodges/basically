/**
 * The video half of the 10,000-gate ASIC: four screen modes, a 16-entry CLUT
 * over the 128-colour palette, the border, and the line interrupt.
 */

/** Colours the palette can express; sixteen of them are on screen at once. */
export const PALETTE_COLOURS = 128;

/** Entries in the colour lookup table. */
export const CLUT_ENTRIES = 16;

export class SamAsic {
  writePort(_port: number, _value: number): void {
    throw new Error('samcoupe: not implemented');
  }

  readPort(_port: number): number {
    throw new Error('samcoupe: not implemented');
  }
}
