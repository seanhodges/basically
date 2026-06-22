/**
 * Stub — filled in by Stage 1 of docs/dialect-plans/zxspectrum128.md. The
 * inverse of the tokenizer: the 48K detokenizer extended with the SPECTRUM
 * (0xA3) and PLAY (0xA4) tokens (share ../zxspectrum/detokenizer parameterized
 * by keyword table).
 */
export function detokenizeProgram(_program: Uint8Array): string {
  throw new Error('zxspectrum128: detokenizer not implemented');
}
