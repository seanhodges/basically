import type { TokenizeError } from '../types';

/**
 * TODO (vic20 Stage 1): a thin wrapper over the commodore64 tokenizer via the
 * CbmVariant seam (added by the PET plan's Stage 1 step 0) - VIC20_VARIANT =
 * { progStart: 0x1001, keywordsByLength: c64KeywordsByLength }.
 * See docs/contributing/dialect-plans/vic20.md.
 */
export function tokenizeProgram(_source: string): {
  program: Uint8Array;
  errors: TokenizeError[];
} {
  throw new Error('vic20: not implemented (Stage 1)');
}
