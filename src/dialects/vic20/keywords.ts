import type { KeywordInfo } from '../types';

/**
 * TODO (vic20 Stage 1): VIC-20 BASIC V2 is byte-identical to the C64's table
 * ($80–$CB, π at $FF) - re-export c64Keywords / c64KeywordsByLength /
 * c64WordByToken from ../commodore64/keywords so the sibling import lives in
 * one place. See docs/contributing/dialect-plans/vic20.md.
 */
export const vic20Keywords: KeywordInfo[] = [];

export const vic20WordByToken = new Map<number, string>();
