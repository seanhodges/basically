import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { SAMCOUPE_CONSTRUCTS } from '../../editor/constructs';
import { SAMCOUPE_LEXIS } from '../../editor/variableLexis';
import { samcoupeKeywords, samcoupeOperators } from './keywords';

export const samcoupeCompletionSource: CompletionSource = buildCompletionSource(
  samcoupeKeywords,
  SAMCOUPE_CONSTRUCTS,
);

/** CodeMirror highlighting and languageData for SAM BASIC. */
export function samcoupeLanguageSupport(): Extension {
  // The lexis - `_` in names, `$` the only marker, `&` opening a hex literal -
  // is stated once beside the other machines' and read here, so the
  // highlighter and the lint cannot disagree about what a name is.
  return buildBasicLanguage(samcoupeKeywords, samcoupeCompletionSource, {
    ...SAMCOUPE_LEXIS,
    operators: samcoupeOperators,
  });
}
