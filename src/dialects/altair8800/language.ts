// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { constructsByDialect } from '../../editor/constructs';
import { altair8800Keywords, altair8800Operators } from './keywords';

/**
 * 8K BASIC crunches the way every Microsoft BASIC does: it matches a reserved
 * word wherever one starts, without needing a delimiter, so `FORI=1TO10` stores
 * FOR, TO and the rest as tokens. Confirmed at the console - that exact line
 * stores `81 49 AC 31 9E 31 30 …`.
 *
 * Note the one place this differs from "ignores spaces": the interpreter does
 * *not* skip spaces while matching. `PR INT 1` keeps its `P` and `R` as plain
 * characters and then tokenizes the `INT`, so the space is significant to the
 * match even though it is stored verbatim.
 */
export const altair8800Crunched = true;

export const altair8800CompletionSource: CompletionSource =
  buildCompletionSource(altair8800Keywords, constructsByDialect.altair8800, {
    crunched: altair8800Crunched,
  });

export function altair8800LanguageSupport(): Extension {
  // 8K BASIC variable names are letters and digits with an optional `$` for a
  // string; only the first two characters are significant (the linter in
  // `src/editor/variableLint.ts` covers that). `$` is the *only* type tag -
  // `%`, `!` and `#` arrive with Level II and Extended BASIC, and `10 X%=1`
  // here stores fine but answers `?SN ERROR IN 10` on RUN. There are no `&H`
  // literals (Disk BASIC) and no graphics escapes (the machine has no graphics
  // characters at all), so both stay off.
  return buildBasicLanguage(altair8800Keywords, altair8800CompletionSource, {
    operators: altair8800Operators,
    suffixChars: '$',
    graphicsEscapes: false,
    crunched: altair8800Crunched,
  });
}
