// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { keywordSpellingsFor } from '../keywordSpellings';
import { buildCompletionSource } from '../../editor/completions';
import { APPLE2_CONSTRUCTS } from '../../editor/constructs';
import { apple2Keywords, apple2Operators } from './keywords';

/**
 * Integer BASIC crunches: the entry parser skips spaces everywhere outside a
 * string literal and a REM body, so `FORI=1TO10` is stored as FOR I = 1 TO 10
 * and `PR INT 1` as PRINT 1. Read back off the machine, which stores the first
 * of those as `55 C9 56 B1 01 00 57 B1 0A 00`.
 */
export const apple2Crunched = true;

export const apple2CompletionSource: CompletionSource = buildCompletionSource(
  apple2Keywords,
  APPLE2_CONSTRUCTS,
  { crunched: apple2Crunched },
);

export function apple2LanguageSupport(): Extension {
  // Every omission below is a fact about the machine rather than a gap: there is
  // no hex literal (`PEEK` and `POKE` take signed decimal, which is why an I/O
  // address is written `PEEK(-16384)`), no binary literal, no graphics escapes
  // (the character generator holds 64 ASCII glyphs and no pictures), and no
  // `%` suffix because there is no second numeric type to tell apart - `$` is
  // the only marker, and even that is stored as a token rather than as part of
  // the name.
  return buildBasicLanguage(apple2Keywords, apple2CompletionSource, {
    // No abbreviation of any kind: no dotted prefix, no shifted letter, and no
    // `?` for PRINT - typing `?1` at the > prompt answers *** SYNTAX ERR, which
    // is the one thing the Applesoft machine next door does differently - so
    // this resolves to the empty answer, which is the right one.
    spellings: keywordSpellingsFor('apple2'),
    operators: apple2Operators,
    suffixChars: '$',
    graphicsEscapes: false,
    crunched: apple2Crunched,
  });
}
