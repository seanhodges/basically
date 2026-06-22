import type { KeywordInfo } from '../types';
import { spectrumKeywords } from '../zxspectrum/keywords';

/**
 * The two 128-only tokens the 48K table deliberately omits: SPECTRUM (0xA3)
 * and PLAY (0xA4). They sit just below the 48K block (RND is 0xA5), so the
 * full 128 BASIC table is the 48K set with these two prepended-by-token-value
 * keywords appended to the array — token order in the array does not matter to
 * the tokenizer (it matches by word, longest-first) or the detokenizer (it
 * looks up by token byte).
 */
export const SPECTRUM_KEYWORD: KeywordInfo = {
  word: 'SPECTRUM',
  token: 0xa3,
  kind: 'command',
  signature: 'SPECTRUM',
  doc: 'Return to 48 BASIC (switch the machine back to 48K mode).',
};

export const PLAY_KEYWORD: KeywordInfo = {
  word: 'PLAY',
  token: 0xa4,
  kind: 'command',
  signature: 'PLAY a$[,b$…]',
  doc: 'Play one or more music strings on the AY-3-8912 sound chip (one string per channel).',
};

/**
 * 128 BASIC = the 48K Spectrum keyword table plus SPECTRUM and PLAY. Sharing
 * the 48K array keeps highlighting/completion identical for 48K-compatible code
 * and adds only the two new commands. See docs/dialect-plans/zxspectrum128.md.
 */
export const spectrum128Keywords: KeywordInfo[] = [
  ...spectrumKeywords,
  SPECTRUM_KEYWORD,
  PLAY_KEYWORD,
];
