import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { constructsByDialect } from '../../editor/constructs';
import { atomKeywords, atomOperators } from './keywords';

export const atomCompletionSource: CompletionSource = buildCompletionSource(
  atomKeywords,
  constructsByDialect.atom,
);

export function atomLanguageSupport(): Extension {
  // Atom quirks: hex literals use a '#' prefix (where the BBC uses '&'); there
  // are no ZX-style block-graphics escapes; the Atom has no '%'/'$' variable
  // type suffix (strings are addressed via the '$' prefix operator, not a
  // suffix). The Atom's own operators '!' (word indirection), '%' (remainder),
  // '&' (AND) and '\' (OR) are added via extraOperators; '?' (byte), '$'
  // (string) and ':' (XOR) already sit in the shared operator set.
  //
  // Cosmetic note: styling '%' as an operator also colours the '%' in an
  // FP-variable reference (%A..%Z) navy. That's an accepted minor imperfection -
  // the reference treats '%' as the remainder operator.
  return buildBasicLanguage(atomKeywords, atomCompletionSource, {
    hexPrefix: '#',
    graphicsEscapes: false,
    suffixChars: '',
    operators: atomOperators,
  });
}
