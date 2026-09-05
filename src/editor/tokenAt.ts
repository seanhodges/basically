// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The token written at a document position, as the active machine reads it.
 *
 * Both editors are CodeMirror stream languages, and both already decide - per
 * dialect - what every run of characters is: a keyword, a function name, an
 * operator, a variable, a line number, a literal. Asking their tree is asking
 * the machine's own answer, and it costs nothing to keep the two in step.
 *
 * Two facts the code below cannot state for itself:
 *
 * - **A stream language names its nodes after the tag strings its tokenizer
 *   returns.** `@codemirror/language` builds a NodeType per distinct tag with
 *   `name` set to that string, so the names matched here (`keyword`,
 *   `functionName`, `operator`, …) are literally what `basicLanguage`'s and
 *   `asmStreamParser`'s `token()` return. There is no mapping table to keep
 *   honest, and a tag renamed on either side stops matching here.
 * - **The tree lags the viewport, so it is forced rather than trusted.**
 *   `syntaxTree` returns only what has been parsed so far; on a large document
 *   that can be a few kilobytes of a much longer program, and a resolve past
 *   the parsed region quietly returns the top node. A click is normally inside
 *   the parsed viewport, but "normally" is not a guarantee after a large paste
 *   or a fast scroll, and the failure it produces - a menu row that is
 *   sometimes missing - is the kind nobody reports. So parse up to the end of
 *   the clicked line first, within a budget that is generous for one line.
 */
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';

/** A token with its text, its extent and the kind the tokenizer gave it. */
export interface EditorToken {
  text: string;
  from: number;
  to: number;
  /** The tokenizer's own tag string, e.g. `keyword` or `operator`. */
  kind: string;
}

/**
 * How long to spend parsing up to the clicked line before giving up and using
 * whatever tree exists. Measured against a ~79KB program, where the whole
 * document parses well inside this; one line has room to spare.
 */
const PARSE_BUDGET_MS = 50;

/**
 * The token `tree` holds at `pos`, whatever its kind, or null for none.
 *
 * Both edges of a token count, so clicking either end of a name still picks it:
 * the forward-biased resolve catches the left edge and the interior, and the
 * backward-biased one is asked only when that finds nothing at all - at the end
 * of a token, or in whitespace where both sides yield the top node.
 *
 * Falling back on kind rather than on presence would be wrong: where two tokens
 * abut, as a crunched `POKEA` splits into a keyword and a variable, the
 * position between them belongs to the token that starts there. Reaching past a
 * variable the caller did not want, to the keyword ending at the same offset,
 * would answer about the wrong half of the run.
 */
function nodeAt(tree: ReturnType<typeof syntaxTree>, pos: number) {
  for (const side of [1, -1] as const) {
    const node = tree.resolveInner(pos, side);
    if (!node.type.isTop && node.from < node.to) return node;
  }
  return null;
}

/**
 * The token at `pos` whose kind is one of `kinds`, or null.
 *
 * The already-parsed tree answers first because it costs nothing and, in a live
 * editor, covers the viewport the click landed in. Forcing the parse is the
 * fallback for the gap described above, and it is bounded: a document long
 * enough to exhaust the budget keeps whatever the lazy tree had.
 */
export function tokenAt(
  state: EditorState,
  pos: number,
  kinds: readonly string[],
): EditorToken | null {
  let node = nodeAt(syntaxTree(state), pos);
  if (!node) {
    const forced = ensureSyntaxTree(
      state,
      state.doc.lineAt(pos).to,
      PARSE_BUDGET_MS,
    );
    if (forced) node = nodeAt(forced, pos);
  }
  if (!node || !kinds.includes(node.name)) return null;
  return {
    text: state.sliceDoc(node.from, node.to),
    from: node.from,
    to: node.to,
    kind: node.name,
  };
}
