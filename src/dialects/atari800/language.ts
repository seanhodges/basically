// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { constructsByDialect } from '../../editor/constructs';
import { keywordSpellingsFor } from '../keywordSpellings';
import { atariKeywords, atariOperators } from './keywords';

/**
 * Atari BASIC ignores spaces outside strings and REM, and matches its reserved
 * words greedily wherever it is looking for one - so `FORI=1TO10` is a loop and
 * `LOGO` is `LOG` followed by `O`. The editor has to split an identifier run
 * the same way the ROM will, or it would colour `FORI` as a name the tokenizer
 * is about to read as two things.
 */
export const atariCrunched = true;

export const atariCompletionSource: CompletionSource = buildCompletionSource(
  atariKeywords,
  constructsByDialect.atari800,
  { crunched: atariCrunched },
);

export function atariLanguageSupport(): Extension {
  // `$` is the only type suffix - Atari BASIC has no integer or precision tags
  // - and an escape is spelled `{clear}`, so `%` and `\` are ordinary
  // characters rather than the Sinclair two-character graphics escapes. There
  // are no `&`/`%` number literals either: the machine reads decimal only.
  return buildBasicLanguage(atariKeywords, atariCompletionSource, {
    operators: atariOperators,
    suffixChars: '$',
    graphicsEscapes: false,
    crunched: atariCrunched,
    // The ROM compares a keyword against an upper-case table and ATASCII keeps
    // the two cases apart, so a lower-case spelling reaches it as a name there
    // - but the tokenizer reads one anyway and says so (`letterCase.ts`'s
    // `lenient`), which is what leaves this at the default `true`.
    spellings: keywordSpellingsFor('atari800'),
  });
}
