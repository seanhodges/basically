import type { CharsetMapping } from '../types';

/**
 * Stub — filled in by Stage 1 of docs/dialect-plans/trs80.md.
 *
 * TRS-80 codes: ASCII 0x20–0x7F maps to itself (the Model I folds lowercase to
 * upper case), 0x80–0xBF are 2×3-pixel block-graphics cells (render via the
 * ▘▝▖▗▌▐▀▄█ Unicode quadrant/half forms, like the Sinclair charsets).
 */
export const trs80Charset: CharsetMapping = {
  toMachine() {
    throw new Error('trs80: charset not implemented');
  },
  toUnicode() {
    throw new Error('trs80: charset not implemented');
  },
  glyph() {
    throw new Error('trs80: charset not implemented');
  },
};
