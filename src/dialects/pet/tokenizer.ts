import {
  tokenizeProgram as tokenizeCbm,
  type CbmVariant,
  type TokenizedProgram,
} from '../commodore64/tokenizer';
import { petKeywordsByLength } from './keywords';
import { PROGRAM_BASE } from './addresses';

/**
 * The PET's Commodore-BASIC variant: programs load at $0401 (vs the C64's
 * $0801) and use the BASIC 4.0 keyword table (C64 BASIC V2 + disk commands).
 */
export const PET_VARIANT: CbmVariant = {
  progStart: PROGRAM_BASE,
  keywordsByLength: petKeywordsByLength,
};

/** Tokenize PET BASIC 4.0 source into the $0401 linked-line program image. */
export function tokenizeProgram(source: string): TokenizedProgram {
  return tokenizeCbm(source, PET_VARIANT);
}
