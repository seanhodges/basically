import { tokenizeProgram as tokenizeSpectrum } from '../zxspectrum/tokenizer';
import { spectrum128Keywords } from './keywords';

export type { TokenizedProgram } from '../zxspectrum/tokenizer';

/**
 * The 128 BASIC tokenizer is the 48K Spectrum tokenizer driven by the extended
 * keyword table (the 48K set plus SPECTRUM (0xA3) and PLAY (0xA4)). The shared
 * logic in ../zxspectrum/tokenizer.ts is parameterized by keyword table, so
 * this is a thin binding rather than a copy. Errors are collected, not thrown.
 * The 128K reuses 0xA3/0xA4 as those tokens, so its UDGs stop at `\s` (0xA2);
 * passing that limit makes `\t`/`\u` earn a non-fatal warning.
 * See docs/dialect-plans/zxspectrum128.md.
 */
export function tokenizeProgram(source: string) {
  return tokenizeSpectrum(source, spectrum128Keywords, 0xa2);
}
