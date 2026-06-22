import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { atomKeywords } from './keywords';

export const atomCompletionSource: CompletionSource =
  buildCompletionSource(atomKeywords);

export function atomLanguageSupport(): Extension {
  // Atom quirks: hex literals use a '#' prefix (where the BBC uses '&'); there
  // are no ZX-style block-graphics escapes; the Atom has no '%'/'$' variable
  // type suffix (strings are addressed via the '$' prefix operator, not a
  // suffix). '?' (byte) and '!' (word) indirection read as operators via the
  // shared operator set.
  return buildBasicLanguage(atomKeywords, atomCompletionSource, {
    hexPrefix: '#',
    graphicsEscapes: false,
    suffixChars: '',
  });
}
