import type { KeywordInfo } from '../types';

/**
 * Stub — filled in by Stage 1 of docs/dialect-plans/trs80.md.
 *
 * TRS-80 Model I Level II BASIC is Microsoft BASIC: each keyword tokenizes to a
 * single byte in the 0x80–0xFB range, with functions encoded as a two-byte
 * 0xFF-prefixed form. The real table sits near 0x1650 in the Level II ROM.
 */
export const trs80Keywords: KeywordInfo[] = [];
