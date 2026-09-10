// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Every token a range of a program holds, as the active machine reads it.
 *
 * The point-shaped question is `./tokenAt`'s; this is the same tree walked
 * rather than resolved, and the same fact carries it: a stream language names
 * its nodes after the tag strings its tokenizer returns, so what comes back
 * here is literally what `./basicLanguage`'s `token()` returned - `keyword`,
 * `functionName`, `operator`, `meta`, `labelName`, `comment`, `string`,
 * `variableName`, `number`, `atom`. Nothing re-reads the text.
 *
 * A token overlapping either edge of the range is returned whole. Clipping it
 * would report a keyword as a shorter keyword, and every caller so far wants to
 * know what the token *is*, not how much of it the range happened to cover.
 */
import { EditorState } from '@codemirror/state';
import { treeCovering, type EditorToken } from './tokenAt';

/**
 * What this spends parsing: as long as it takes.
 *
 * Affordable here where it is not for a click, for two reasons the call cannot
 * state for itself. Nothing is waiting on this answer - it is asked for
 * asynchronously, so the only cost of taking longer is arriving later. And a
 * stream language tokenizes each line once, so the parse is linear in the
 * program's length: the tens of kilobytes any machine this product targets can
 * hold is single-digit milliseconds, and a file far larger than one could load
 * is a fraction of a second, paid once per document version.
 *
 * A cap of any size would re-admit the failure this replaces, because running
 * out of one does not yield a shorter answer: the fallback is the lazily-parsed
 * tree, a fixed few kilobytes whatever the program's length, so a long listing
 * comes back with its first screen classified and the rest reported as holding
 * nothing at all.
 */
const NO_PARSE_BUDGET = Number.POSITIVE_INFINITY;

/**
 * Every token overlapping `[from, to)`, in document order.
 *
 * The tree is forced up to `to` rather than trusted: an unparsed region holds
 * no nodes, which is indistinguishable from a region of whitespace, so trusting
 * the lazy tree would quietly return a short answer for a long program.
 */
export function tokensIn(
  state: EditorState,
  from: number,
  to: number,
): EditorToken[] {
  if (to <= from) return [];
  const tokens: EditorToken[] = [];
  treeCovering(state, to, NO_PARSE_BUDGET).iterate({
    from,
    to,
    enter(node) {
      // The top node spans the document; the tokens are its leaves.
      if (node.type.isTop || node.from >= node.to) return;
      tokens.push({
        text: state.sliceDoc(node.from, node.to),
        from: node.from,
        to: node.to,
        kind: node.name,
      });
    },
  });
  return tokens;
}
