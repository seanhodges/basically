import type { TokenizeError } from '../types';

export interface TokenizedProgram {
  /** Tokenized BASIC program bytes (no system variables), mirroring the 48K. */
  bytes: Uint8Array;
  errors: TokenizeError[];
}

/**
 * Stub — filled in by Stage 1 of docs/dialect-plans/zxspectrum128.md.
 *
 * The 128 BASIC tokenizer is the 48K Spectrum tokenizer plus the SPECTRUM
 * (0xA3) and PLAY (0xA4) keywords. Stage 1 should parameterize
 * ../zxspectrum/tokenizer.ts by keyword table (default = spectrumKeywords,
 * backward-compatible) rather than copy the logic. Collect TokenizeError[]
 * (1-based line, 0-based column); do not throw.
 */
export function tokenizeProgram(_source: string): TokenizedProgram {
  throw new Error('zxspectrum128: tokenizer not implemented');
}
