// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { keywordSpellingsFor } from '../keywordSpellings';
import { buildCompletionSource } from '../../editor/completions';
import { SORCERER_CONSTRUCTS } from '../../editor/constructs';
import { sorcererKeywords, sorcererOperators } from './keywords';

/**
 * Exidy Standard BASIC crunches the way every Microsoft BASIC does: it matches
 * a reserved word wherever one starts, without needing a delimiter, so
 * `FORI=1TO10` stores FOR, TO and the rest as tokens.
 *
 * Note the one place this differs from "ignores spaces": CRUNCH does *not* skip
 * spaces while matching. A 0x20 goes straight to its store path without the
 * reserved-word table being consulted at all, so `PR INT 1` keeps its `P` and
 * `R` as plain characters and then tokenizes the `INT` - the space is
 * significant to the match even though it is stored verbatim.
 */
export const sorcererCrunched = true;

export const sorcererCompletionSource: CompletionSource = buildCompletionSource(
  sorcererKeywords,
  SORCERER_CONSTRUCTS,
  { crunched: sorcererCrunched },
);

export function sorcererLanguageSupport(): Extension {
  // Variable names are letters and digits with an optional `$` for a string;
  // only the first two characters are significant (the linter in
  // `src/editor/variableLint.ts` covers that). `$` is the *only* type tag -
  // `%`, `!` and `#` arrive with the larger Microsoft BASICs - and there are no
  // `&H` literals. `graphicsEscapes` is off because it is the Sinclair `%`/`\`
  // pair, which this machine has no use for: its graphics characters are
  // characters, written as themselves, and its unmappable bytes take the
  // `{0xNN}` escape the charset defines.
  return buildBasicLanguage(sorcererKeywords, sorcererCompletionSource, {
    spellings: keywordSpellingsFor('sorcerer'),
    operators: sorcererOperators,
    suffixChars: '$',
    graphicsEscapes: false,
    crunched: sorcererCrunched,
  });
}
