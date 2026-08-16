import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { keywordSpellingsFor } from '../keywordSpellings';
import { buildCompletionSource } from '../../editor/completions';
import { constructsByDialect } from '../../editor/constructs';
import { cpc6128Keywords } from './keywords';

/**
 * The 6128's editor language layer. Identical to the 464's in every option -
 * same suffix chars, same `&`/`&X` literal prefixes, same constructs - and
 * differs only in the keyword table it highlights and completes, which is the
 * BASIC 1.1 one. See ../cpc464/language.ts.
 */
export const cpc6128CompletionSource: CompletionSource = buildCompletionSource(
  cpc6128Keywords,
  constructsByDialect.cpc6128,
);

export function cpc6128LanguageSupport(): Extension {
  return buildBasicLanguage(cpc6128Keywords, cpc6128CompletionSource, {
    spellings: keywordSpellingsFor('cpc6128'),
    operators: ['↑'],
    suffixChars: '$%!',
    graphicsEscapes: false,
    hexPrefix: '&H?',
    binaryPrefix: '&X',
  });
}
