import type { KeywordInfo } from '../types';

/**
 * SAM BASIC's keyword table: one token byte per keyword, as the ROM stores it.
 *
 * Transcribe it from the ROM's own keyword list rather than from a manual - the
 * v3.0 source is published, and the dispatch table sits beside the strings.
 */
export const samcoupeKeywords: KeywordInfo[] = [];

/**
 * Operator spellings the machine stores as characters rather than tokens, so
 * the keyword table above cannot carry them.
 */
export const samcoupeOperators: readonly string[] = [];
