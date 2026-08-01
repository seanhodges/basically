import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { constructsByDialect } from '../../editor/constructs';
import { petKeywords } from './keywords';

/** See `c64Crunched`: the PET shares the C64's ROM tokenizer behaviour. */
export const petCrunched = true;

export const petCompletionSource: CompletionSource = buildCompletionSource(
  petKeywords,
  constructsByDialect.pet,
  { crunched: petCrunched },
);

export function petLanguageSupport(): Extension {
  // PET BASIC 4.0 shares the C64's lexical rules: variable names are
  // letters/digits ending optionally in '$' (string) or '%' (integer), only the
  // first two characters are significant, there are no hex/binary literals or
  // block-graphics escapes in source, and the ROM ignores spaces outside
  // strings/REM ("code crunching") — so the editor splits glued keywords the
  // same way.
  return buildBasicLanguage(petKeywords, petCompletionSource, {
    suffixChars: '$%',
    graphicsEscapes: false,
    crunched: petCrunched,
  });
}
