import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { spectrum128Keywords } from './keywords';

// Mirrors ../zxspectrum/language.ts but over the 128 keyword table (which gains
// SPECTRUM/PLAY in Stage 1). The Spectrum needs no special BasicLanguageOptions
// — BIN/IN/OUT etc. are keywords, not lexical prefixes.
export const spectrum128CompletionSource: CompletionSource =
  buildCompletionSource(spectrum128Keywords);

export function spectrum128LanguageSupport(): Extension {
  return buildBasicLanguage(spectrum128Keywords, spectrum128CompletionSource);
}
