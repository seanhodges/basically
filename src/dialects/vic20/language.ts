import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { constructsByDialect } from '../../editor/constructs';
import { vic20Keywords } from './keywords';

export const vic20CompletionSource: CompletionSource = buildCompletionSource(
  vic20Keywords,
  constructsByDialect.vic20,
  { crunched: true },
);

export function vic20LanguageSupport(): Extension {
  // VIC-20 BASIC V2 shares the C64's lexical rules: variable names are
  // letters/digits ending optionally in '$' (string) or '%' (integer), only the
  // first two characters are significant, there are no hex/binary literals or
  // block-graphics escapes in source, and the ROM ignores spaces outside
  // strings/REM ("code crunching") — so the editor splits glued keywords the
  // same way.
  return buildBasicLanguage(vic20Keywords, vic20CompletionSource, {
    suffixChars: '$%',
    graphicsEscapes: false,
    crunched: true,
  });
}
