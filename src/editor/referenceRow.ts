// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The menu row that opens the language reference at the picked token.
 *
 * The token comes from the machine's own tokenizer ({@link ./tokenAt}), so what
 * is offered is what that machine reads as a keyword, function, operator or
 * instruction - not what looks like one.
 *
 * Operators need one step more than the tokenizer gives. Adjacent operator
 * characters arrive as a single node - the highlighter draws a run of them as
 * one - so `A=.5` yields `=.` and `A=-1` yields `=-`, neither of which is a
 * spelling anything could look up. The dialect already declares every spelling
 * it has, so the run is cut back to the longest declared one covering the click.
 * That also settles the punctuation that separates the parts of a line (`,`,
 * `;`, `(`, `)`, `:`, and the decimal point): the highlighter tags it as an
 * operator on every machine so it colours consistently, but no machine declares
 * it as one and no reference page carries a row for it, so nothing is offered.
 */
import type { EditorState } from '@codemirror/state';
import type { MenuRowSource } from './clickMenu';
import { tokenAt, type EditorToken } from './tokenAt';

/** What a BASIC reference lookup accepts: commands, functions and operators. */
export const BASIC_REFERENCE_KINDS = ['keyword', 'functionName', 'operator'];

/** What an assembly reference lookup accepts: instructions and directives. */
export const ASM_REFERENCE_KINDS = ['keyword'];

/**
 * The longest declared spelling inside `token` that covers `pos`, or null.
 * Longest first, so `<=` wins over the `<` it starts with.
 *
 * A spelling covers the offset it contains, and the run's own trailing edge is
 * counted too so that clicking just past a lone `=` still picks it. The edges
 * *inside* the run are deliberately not counted: they are real boundaries
 * between two tokens the highlighter happened to draw as one, so the offset
 * between `=` and `.` belongs to the `.` that starts there, and answers nothing
 * rather than reaching back to the `=`.
 */
function declaredOperatorAt(
  token: EditorToken,
  pos: number,
  operators: ReadonlySet<string>,
): EditorToken | null {
  const offset = pos - token.from;
  const end = token.text.length;
  for (let len = end; len >= 1; len--) {
    for (let start = 0; start + len <= end; start++) {
      const covers =
        start <= offset &&
        (offset < start + len || (offset === end && start + len === end));
      if (!covers) continue;
      const candidate = token.text.slice(start, start + len);
      if (!operators.has(candidate)) continue;
      return {
        text: candidate,
        from: token.from + start,
        to: token.from + start + len,
        kind: token.kind,
      };
    }
  }
  return null;
}

/**
 * The token at `pos` that has something to look up, or null. `operators` is the
 * machine's own set of spellings, used only to cut an operator run back as
 * described above; pass an empty set where the accepted kinds hold no operators.
 */
export function referenceTokenAt(
  state: EditorState,
  pos: number,
  kinds: readonly string[],
  operators: ReadonlySet<string>,
): EditorToken | null {
  const token = tokenAt(state, pos, kinds);
  if (!token) return null;
  if (token.kind !== 'operator') return token;
  return declaredOperatorAt(token, pos, operators);
}

export interface ReferenceRowOptions {
  /** Token kinds this editor looks up - BASIC or assembly. */
  kinds: readonly string[];
  /** The machine's operator spellings; empty where `kinds` holds no operators. */
  operators: ReadonlySet<string>;
  /** The docs sub-path for `word`, or null when it has nowhere to go. */
  topic: (word: string) => string | null;
  /** Open the documentation at a resolved topic. */
  open: (topic: string) => void;
}

/**
 * The row. Withheld where {@link ReferenceRowOptions.topic} declines, so the
 * menu never offers a lookup that would land nowhere.
 */
export function referenceRow(options: ReferenceRowOptions): MenuRowSource {
  return (state, pos) => {
    const token = referenceTokenAt(
      state,
      pos,
      options.kinds,
      options.operators,
    );
    if (!token) return null;
    const topic = options.topic(token.text);
    if (!topic) return null;
    return {
      from: token.from,
      to: token.to,
      label: 'Reference',
      icon: 'reference',
      title: `Look up ${token.text} in the reference`,
      run: () => options.open(topic),
    };
  };
}
