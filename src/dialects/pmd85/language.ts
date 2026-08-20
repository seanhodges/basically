// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { keywordSpellingsFor } from '../keywordSpellings';
import { buildCompletionSource } from '../../editor/completions';
import { constructsByDialect } from '../../editor/constructs';
import { pmd85Keywords, pmd85Operators } from './keywords';

/**
 * BASIC-G crunches the way every Microsoft BASIC does: it matches a reserved
 * word wherever one starts, without needing a delimiter, so `FORI=1TO10` stores
 * FOR, TO and the rest as tokens.
 *
 * Note the one place this differs from "ignores spaces": the crunch does not
 * skip spaces while matching, so `PR INT 1` keeps its `P` and `R` as plain
 * characters and then tokenizes the `INT`. GOTO alone is matched across spaces
 * (see `tokenizer.ts`).
 */
export const pmd85Crunched = true;

export const pmd85CompletionSource: CompletionSource = buildCompletionSource(
  pmd85Keywords,
  constructsByDialect.pmd85,
  { crunched: pmd85Crunched },
);

export function pmd85LanguageSupport(): Extension {
  // BASIC-G variable names are letters and digits with an optional `$` for a
  // string, and only the first two characters are significant (the linter in
  // `src/editor/variableLint.ts` covers that). `$` is the only type tag: the
  // `%`, `!` and `#` of the later, larger Microsoft BASICs are not in this one.
  // A hexadecimal literal is written `'FF`, not `&HFF` - the apostrophe is the
  // prefix rather than a comment marker here - and there are no graphics
  // escapes, because the character generator holds no graphics characters.
  return buildBasicLanguage(pmd85Keywords, pmd85CompletionSource, {
    spellings: keywordSpellingsFor('pmd85'),
    operators: pmd85Operators,
    suffixChars: '$',
    hexPrefix: "'",
    graphicsEscapes: false,
    crunched: pmd85Crunched,
  });
}
