import {
  tokenizeProgram as tokenizeCbm,
  type CbmVariant,
  type TokenizedProgram,
} from '../commodore64/tokenizer';
import { vic20KeywordsByLength } from './keywords';
import { PROGRAM_BASE } from './addresses';

/**
 * The VIC-20's Commodore-BASIC variant: programs load at $1001 (vs the C64's
 * $0801) on the unexpanded machine and use the plain BASIC V2 keyword table,
 * byte-identical to the C64's. RAM expansions relocate BASIC ($0401 with +3K,
 * $1201 with +8K/+16K) and are out of scope for Stage 1.
 */
export const VIC20_VARIANT: CbmVariant = {
  progStart: PROGRAM_BASE,
  keywordsByLength: vic20KeywordsByLength,
};

/** Tokenize VIC-20 BASIC V2 source into the $1001 linked-line program image. */
export function tokenizeProgram(source: string): TokenizedProgram {
  return tokenizeCbm(source, VIC20_VARIANT);
}
