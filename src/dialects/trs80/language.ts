import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { constructsByDialect } from '../../editor/constructs';
import { trs80Keywords, trs80Operators } from './keywords';

/** See `c64Crunched`: Level II BASIC crunches the same way. */
export const trs80Crunched = true;

export const trs80CompletionSource: CompletionSource = buildCompletionSource(
  trs80Keywords,
  constructsByDialect.trs80,
  { crunched: trs80Crunched },
);

export function trs80LanguageSupport(): Extension {
  // Level II variable names are letters/digits with an optional type tag - `$`
  // string, `%` integer, `!` single, `#` double; only the first two characters
  // are significant. There are no `&H`/`&B` literals (that is Disk BASIC) and no
  // block-graphics escapes in source, so both stay off. The ROM ignores spaces
  // outside strings/REM ("code crunching": POKEA,10 is valid), so the editor
  // splits glued keywords the same way.
  return buildBasicLanguage(trs80Keywords, trs80CompletionSource, {
    // `^` alongside the canonical `↑`, as on the Commodores: an alias the
    // tokenizer takes and LIST never gives back.
    operators: [...trs80Operators, '^'],
    suffixChars: '$%!#',
    graphicsEscapes: false,
    crunched: trs80Crunched,
  });
}
