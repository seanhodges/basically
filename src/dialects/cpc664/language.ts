import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { keywordSpellingsFor } from '../keywordSpellings';
import { buildCompletionSource } from '../../editor/completions';
import { constructsByDialect } from '../../editor/constructs';
import { cpc664Keywords } from './keywords';

/**
 * The 664's editor language layer. Identical to the 464's in every option -
 * same suffix chars, same `&`/`&X` literal prefixes, same constructs - and
 * differs only in the keyword table it highlights and completes, which is the
 * BASIC 1.1 one. See ../cpc464/language.ts.
 */
export const cpc664CompletionSource: CompletionSource = buildCompletionSource(
  cpc664Keywords,
  constructsByDialect.cpc664,
);

export function cpc664LanguageSupport(): Extension {
  return buildBasicLanguage(cpc664Keywords, cpc664CompletionSource, {
    spellings: keywordSpellingsFor('cpc664'),
    operators: ['↑'],
    suffixChars: '$%!',
    graphicsEscapes: false,
    hexPrefix: '&H?',
    binaryPrefix: '&X',
  });
}
