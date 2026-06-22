import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { trs80Keywords } from './keywords';

export const trs80CompletionSource: CompletionSource =
  buildCompletionSource(trs80Keywords);

export function trs80LanguageSupport(): Extension {
  // Level II variable names are letters/digits with an optional type tag — `$`
  // string, `%` integer, `!` single, `#` double; only the first two characters
  // are significant. There are no `&H`/`&B` literals (that is Disk BASIC) and no
  // block-graphics escapes in source, so both stay off.
  return buildBasicLanguage(trs80Keywords, trs80CompletionSource, {
    suffixChars: '$%!#',
    graphicsEscapes: false,
  });
}
