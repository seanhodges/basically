import type { KeywordInfo } from '../types';
import { spectrumKeywords } from '../zxspectrum/keywords';

/**
 * Stub — Stage 1 of docs/dialect-plans/zxspectrum128.md appends the two
 * 128-only tokens the 48K table deliberately omits: SPECTRUM (0xA3) and
 * PLAY (0xA4). Until then the 128K shares the 48K Spectrum keyword table
 * verbatim, so highlighting and completion already work for 48K-compatible code.
 */
export const spectrum128Keywords: KeywordInfo[] = [...spectrumKeywords];
