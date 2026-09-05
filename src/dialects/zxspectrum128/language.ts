import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { constructsByDialect } from '../../editor/constructs';
import { spectrum128Keywords } from './keywords';
import { spectrumOperators } from '../zxspectrum/keywords';

// Mirrors ../zxspectrum/language.ts but over the 128 keyword table (which adds
// SPECTRUM/PLAY), and over the same operator set: the 128 is a 48K with a sound
// chip, not a different language. BIN/IN/OUT etc. are keywords, not lexical
// prefixes, so nothing else is needed.
export const spectrum128CompletionSource: CompletionSource =
  buildCompletionSource(spectrum128Keywords, constructsByDialect.zxspectrum128);

export function spectrum128LanguageSupport(): Extension {
  return buildBasicLanguage(spectrum128Keywords, spectrum128CompletionSource, {
    operators: spectrumOperators,
  });
}
