import { detokenizeProgram as detokenizeSpectrum } from '../zxspectrum/detokenizer';
import { spectrum128Keywords } from './keywords';

/**
 * The inverse of the tokenizer: the 48K Spectrum detokenizer driven by the
 * extended 128 keyword table so the SPECTRUM (0xA3) and PLAY (0xA4) tokens
 * detokenize. Shares ../zxspectrum/detokenizer parameterized by keyword table.
 * See docs/dialect-plans/zxspectrum128.md.
 */
export function detokenizeProgram(program: Uint8Array): string {
  return detokenizeSpectrum(program, spectrum128Keywords);
}
