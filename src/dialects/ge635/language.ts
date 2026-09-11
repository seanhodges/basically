// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { GE635_CONSTRUCTS } from '../../editor/constructs';
import { GE635_LEXIS } from '../../editor/variableLexis';
import { ge635Keywords, ge635Operators } from './keywords';

/**
 * Blanks are not significant to a keyword match, so `FORI=1TO10` is a loop.
 *
 * The manual never states the rule, which is why this is argued rather than
 * quoted: it writes the same statement both ways, `250 G0 T0 999` in section
 * 2.5 and `G0T0` in the paragraph above it, and heads section 1.7.6's switch
 * `0N ... G0 T0`. Both spellings reaching the same decoder is only possible if
 * the blank is gone before the decoder looks. It is also what the GE-235 does,
 * whose compiler listing says so outright.
 */
export const ge635Crunched = true;

export const ge635CompletionSource: CompletionSource = buildCompletionSource(
  ge635Keywords,
  GE635_CONSTRUCTS,
  { crunched: ge635Crunched },
);

/** CodeMirror highlighting and languageData for Dartmouth BASIC's fourth edition. */
export function ge635LanguageSupport(): Extension {
  // No graphics escapes, because there are no graphics: the output is a paper
  // roll and the character set has no block shapes in it. The lexis next door
  // carries the rest - `$` as the one type marker, no literal prefix, and the
  // crunching above - so the highlighter and the lint cannot disagree about
  // what a name is.
  return buildBasicLanguage(ge635Keywords, ge635CompletionSource, {
    ...GE635_LEXIS,
    operators: ge635Operators,
    graphicsEscapes: false,
  });
}
