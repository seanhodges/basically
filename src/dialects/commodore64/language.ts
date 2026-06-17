import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { c64Keywords } from './keywords';

export const c64CompletionSource: CompletionSource =
  buildCompletionSource(c64Keywords);

export function c64LanguageSupport(): Extension {
  // C64 variable names are letters/digits ending optionally in '$' (string) or
  // '%' (integer); only the first two characters are significant. BASIC v2 has
  // no hex/binary literals and no block-graphics escapes in source.
  return buildBasicLanguage(c64Keywords, c64CompletionSource, {
    suffixChars: '$%',
    graphicsEscapes: false,
  });
}
