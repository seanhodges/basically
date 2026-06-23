import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { constructsByDialect } from '../../editor/constructs';
import { spectrumKeywords } from './keywords';

export const spectrumCompletionSource: CompletionSource = buildCompletionSource(
  spectrumKeywords,
  constructsByDialect.zxspectrum,
);

export function spectrumLanguageSupport(): Extension {
  return buildBasicLanguage(spectrumKeywords, spectrumCompletionSource);
}
