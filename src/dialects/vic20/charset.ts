import type { CharsetMapping } from '../types';

/**
 * TODO (vic20 Stage 1): re-export the C64 charset - PETSCII is identical on
 * the VIC-20. See docs/contributing/dialect-plans/vic20.md.
 */
export const vic20Charset: CharsetMapping = {
  toMachine(_text: string): Uint8Array {
    throw new Error('vic20: not implemented (Stage 1)');
  },
  toUnicode(_codes: ArrayLike<number>): string {
    throw new Error('vic20: not implemented (Stage 1)');
  },
  glyph(_code: number): string {
    throw new Error('vic20: not implemented (Stage 1)');
  },
};
