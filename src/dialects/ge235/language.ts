// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { GE235_CONSTRUCTS } from '../../editor/constructs';
import { GE235_LEXIS } from '../../editor/variableLexis';
import { ge235Keywords, ge235Operators } from './keywords';

/**
 * The compiler deletes every blank outside a string literal as it reads a line
 * in - `trans` in `BA-1` maps space and tab to a code the caller throws away -
 * so keyword matching is position-independent exactly as the Microsoft family's
 * is, and `FORI=1TO10` is a loop. It goes further than crunching does there:
 * the blank is gone before anything looks at the line, so `P R I N T` is PRINT
 * and `GO TO` is GOTO, neither of which a Microsoft ROM would accept.
 */
export const ge235Crunched = true;

export const ge235CompletionSource: CompletionSource = buildCompletionSource(
  ge235Keywords,
  GE235_CONSTRUCTS,
  { crunched: ge235Crunched },
);

/** CodeMirror highlighting and languageData for Dartmouth BASIC. */
export function ge235LanguageSupport(): Extension {
  // No graphics escapes, because there are no graphics: the output is a paper
  // roll and the character set has no block shapes in it. The lexis next door
  // carries the rest - no type marker, no literal prefix, and the crunching
  // above - so the highlighter and the lint cannot disagree about what a name
  // is.
  return buildBasicLanguage(ge235Keywords, ge235CompletionSource, {
    ...GE235_LEXIS,
    operators: ge235Operators,
    graphicsEscapes: false,
  });
}
