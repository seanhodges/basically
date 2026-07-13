import type { KeywordInfo } from '../types';

/**
 * TODO (pet Stage 1): the C64 BASIC V2 table (byte-identical on the PET,
 * $80–$CB with π at $FF, sibling-imported from ../commodore64/keywords) plus
 * the fifteen BASIC 4.0 disk keywords CONCAT $CC … DIRECTORY $DA. Derive
 * petKeywordsByLength and petWordByToken the same way the C64 module does.
 * See docs/contributing/dialect-plans/pet.md.
 */
export const petKeywords: KeywordInfo[] = [];

export const petWordByToken = new Map<number, string>();
