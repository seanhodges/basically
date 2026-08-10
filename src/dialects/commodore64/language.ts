import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { constructsByDialect } from '../../editor/constructs';
import { c64Keywords, c64Operators } from './keywords';

/**
 * The ROM ignores spaces outside strings/REM and matches the longest keyword at
 * every position. Stated here once and read by both consumers: the editor
 * extensions below, and `Dialect.crunched` in `./index` (which imports this
 * module, so the constant lives on this side of the pair).
 */
export const c64Crunched = true;

export const c64CompletionSource: CompletionSource = buildCompletionSource(
  c64Keywords,
  constructsByDialect.commodore64,
  { crunched: c64Crunched },
);

export function c64LanguageSupport(): Extension {
  // C64 variable names are letters/digits ending optionally in '$' (string) or
  // '%' (integer); only the first two characters are significant. BASIC v2 has
  // no hex/binary literals and no block-graphics escapes in source. The ROM
  // ignores spaces outside strings/REM ("code crunching": POKEA,10 is valid),
  // so the editor splits glued keywords the same way.
  return buildBasicLanguage(c64Keywords, c64CompletionSource, {
    // The alias `^` alongside the canonical `↑`: the tokenizer accepts both, so
    // the editor colours both, but only `↑` is what LIST spells back.
    operators: [...c64Operators, '^'],
    suffixChars: '$%',
    graphicsEscapes: false,
    crunched: c64Crunched,
  });
}
