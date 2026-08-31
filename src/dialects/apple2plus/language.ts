// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { APPLE2PLUS_CONSTRUCTS } from '../../editor/constructs';
import { keywordSpellingsFor } from '../keywordSpellings';
import { apple2plusKeywords, apple2plusOperators } from './keywords';

/**
 * Applesoft crunches: the parser discards every space outside a string, a REM
 * body and a DATA statement, and skips them while matching a keyword too - so
 * `PR INT 1` stores as PRINT 1 and `FORI=1TO10` as FOR I = 1 TO 10, and LIST
 * puts its own spacing back because none was kept. Read off the machine, which
 * stores `10 PRINT   1` as `BA 31`.
 */
export const apple2plusCrunched = true;

export const apple2plusCompletionSource: CompletionSource =
  buildCompletionSource(apple2plusKeywords, APPLE2PLUS_CONSTRUCTS, {
    crunched: apple2plusCrunched,
  });

export function apple2plusLanguageSupport(): Extension {
  // Each omission is a fact about the interpreter rather than a gap: no hex or
  // binary literal (`PEEK` and `POKE` take signed decimal, which is why an I/O
  // address is written `PEEK(-16384)`), and no graphics escapes, the character
  // generator holding 64 ASCII glyphs and no pictures.
  return buildBasicLanguage(apple2plusKeywords, apple2plusCompletionSource, {
    // `?` for PRINT is the one short spelling this machine has, and it is the
    // only one in the Apple pair: the sibling's table is empty because `?1` at
    // its `>` prompt answers *** SYNTAX ERR. The entry itself lands when the
    // dialect registers; this resolves to the empty answer until then.
    spellings: keywordSpellingsFor('apple2plus'),
    operators: apple2plusOperators,
    // Two numeric types to tell apart, unlike the sibling: `%` marks an integer
    // variable and `$` a string, and both are part of the name.
    suffixChars: '$%',
    graphicsEscapes: false,
    crunched: apple2plusCrunched,
  });
}
