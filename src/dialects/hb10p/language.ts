// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { constructsByDialect } from '../../editor/constructs';
import { keywordSpellingsFor } from '../keywordSpellings';
import { hb10pKeywords, hb10pOperators } from './keywords';

/**
 * MSX BASIC is a Microsoft BASIC, so it crunches: the ROM matches a keyword
 * wherever it appears, spaces or no spaces, which is what makes `FORI=1TO10` a
 * loop and `TOTAL` two tokens and a name.
 */
export const hb10pCrunched = true;

export const hb10pCompletionSource: CompletionSource = buildCompletionSource(
  hb10pKeywords,
  constructsByDialect.hb10p!,
  { crunched: hb10pCrunched },
);

export function hb10pLanguageSupport(): Extension {
  // MSX BASIC carries all four type suffixes - `$` string, `%` integer, `!`
  // single, `#` double - which no other Microsoft BASIC here does; only the
  // first two characters of a name are significant. `&H` opens a hex literal
  // and `&B` a binary one, and `%` is a suffix rather than a graphics escape.
  return buildBasicLanguage(hb10pKeywords, hb10pCompletionSource, {
    spellings: keywordSpellingsFor('hb10p'),
    operators: [...hb10pOperators],
    suffixChars: '$%!#',
    graphicsEscapes: false,
    hexPrefix: '&[Hh]',
    binaryPrefix: '&[Bb]',
    crunched: hb10pCrunched,
  });
}
