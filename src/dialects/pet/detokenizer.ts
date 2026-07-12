import type { DetokenizeResult } from '../types';

/**
 * TODO (pet Stage 1): thin wrappers over the commodore64 detokenizer via the
 * CbmVariant seam ($0401 load address, petWordByToken, PET machine hint).
 * See docs/contributing/dialect-plans/pet.md.
 */
export function detokenizeProgram(_image: Uint8Array): string {
  throw new Error('pet: not implemented (Stage 1)');
}

export function detokenizeProgramWithReport(
  _image: Uint8Array,
): DetokenizeResult {
  throw new Error('pet: not implemented (Stage 1)');
}
