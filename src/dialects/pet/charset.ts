import type { CharsetMapping } from '../types';

/**
 * TODO (pet Stage 1): re-export the C64 charset - PETSCII originated on the
 * PET and the byte mapping is identical (the colour-control escapes are
 * meaningless-but-harmless bytes on a PET).
 * See docs/contributing/dialect-plans/pet.md.
 */
export const petCharset: CharsetMapping = {
  toMachine(_text: string): Uint8Array {
    throw new Error('pet: not implemented (Stage 1)');
  },
  toUnicode(_codes: ArrayLike<number>): string {
    throw new Error('pet: not implemented (Stage 1)');
  },
  glyph(_code: number): string {
    throw new Error('pet: not implemented (Stage 1)');
  },
};
