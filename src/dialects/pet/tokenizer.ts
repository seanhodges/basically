import type { TokenizeError } from '../types';

/**
 * TODO (pet Stage 1): a thin wrapper over the commodore64 tokenizer via the
 * CbmVariant seam - PET_VARIANT = { progStart: 0x0401, keywordsByLength:
 * petKeywordsByLength }. See docs/contributing/dialect-plans/pet.md.
 */
export function tokenizeProgram(_source: string): {
  program: Uint8Array;
  errors: TokenizeError[];
} {
  throw new Error('pet: not implemented (Stage 1)');
}
