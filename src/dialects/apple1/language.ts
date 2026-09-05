// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { keywordSpellingsFor } from '../keywordSpellings';
import { buildCompletionSource } from '../../editor/completions';
import { APPLE1_CONSTRUCTS } from '../../editor/constructs';
import { apple1Keywords, apple1Operators } from './keywords';

/**
 * Integer BASIC crunches: the entry parser skips spaces everywhere outside a
 * string literal and a REM body, so `FORI=1TO10` is stored as FOR I = 1 TO 10.
 * Read back off the machine, which stores that exact line as
 * `55 C9 56 B1 01 00 57 B1 0A 00`.
 */
export const apple1Crunched = true;

export const apple1CompletionSource: CompletionSource = buildCompletionSource(
  apple1Keywords,
  APPLE1_CONSTRUCTS,
  { crunched: apple1Crunched },
);

export function apple1LanguageSupport(): Extension {
  // The sparsest options in the project, and every omission is a fact about the
  // machine rather than a gap: there is no hex literal (`PEEK` and `POKE` take
  // signed decimal, which is why an I/O address is written `PEEK(-12272)`), no
  // binary literal, no graphics escapes (no graphics characters exist), and no
  // type-suffix character in the sense the other dialects mean - `$` is stored
  // as a token of its own rather than as part of the name, and there is no `%`
  // because there is no second numeric type to tell apart.
  return buildBasicLanguage(apple1Keywords, apple1CompletionSource, {
    // No abbreviation of any kind: no dotted prefix, no shifted letter, and no
    // `?` for PRINT - typing `?A` at the > prompt answers *** SYNTAX ERR - so
    // this resolves to the empty answer, which is the right one.
    spellings: keywordSpellingsFor('apple1'),
    operators: apple1Operators,
    suffixChars: '$',
    graphicsEscapes: false,
    crunched: apple1Crunched,
  });
}
