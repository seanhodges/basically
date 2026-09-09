// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * What every run of characters in a program is, so the editor can colour the
 * listing with its own theme.
 *
 * The classification is the editor's own: `tokensIn` walks the same
 * stream-language tree `src/editor/tokenAt.ts` resolves a single position in,
 * so a name that is a keyword on one machine and an ordinary variable on
 * another is reported differently on each, and a crunched run splits exactly
 * where that machine's ROM splits it. Nothing here re-reads the text.
 *
 * Two of the tokenizer's ten tags have no counterpart among the protocol's own
 * kinds, so the legend names them itself: a line number is not a number - the
 * IDE colours the two differently because they are different things - and a
 * graphics escape or inverse-video glyph is not a string. An editor that does
 * not know a kind leaves those runs unstyled, which is what every editor does
 * with every run of a program today.
 */
import type { Range, SemanticTokens } from 'vscode-languageserver';
import type { EditorState } from '@codemirror/state';
import { tokensIn } from '../editor/tokenRuns';
import type { Position } from 'vscode-languageserver';

/**
 * The kinds this server reports, in the order their indices are encoded in.
 * The shim declares exactly this to the editor, so what is offered and what is
 * emitted cannot drift apart.
 */
export const SEMANTIC_TOKEN_TYPES = [
  'keyword',
  'function',
  'operator',
  'comment',
  'string',
  'number',
  'variable',
  'macro',
  'label',
  'atom',
] as const;

/** No token carries a modifier: nothing in the reading of a program distinguishes one. */
export const SEMANTIC_TOKEN_MODIFIERS: readonly string[] = [];

/**
 * Tokenizer tag to protocol kind. A tag missing from here is skipped rather
 * than guessed at, which is what keeps a tag renamed in `basicLanguage.ts` from
 * being silently reported as the wrong thing.
 */
const TYPE_OF_TAG: Readonly<
  Record<string, (typeof SEMANTIC_TOKEN_TYPES)[number]>
> = {
  keyword: 'keyword',
  functionName: 'function',
  operator: 'operator',
  comment: 'comment',
  string: 'string',
  number: 'number',
  variableName: 'variable',
  meta: 'macro',
  labelName: 'label',
  atom: 'atom',
};

const INDEX_OF_TYPE = new Map<string, number>(
  SEMANTIC_TOKEN_TYPES.map((type, index) => [type, index]),
);

/** One token, already placed on a line - the shape the encoding consumes. */
interface PlacedToken {
  line: number;
  character: number;
  length: number;
  typeIndex: number;
}

/**
 * The tokens of `[from, to)` as the protocol's packed five-number groups:
 * line delta, character delta, length, kind, modifiers.
 */
function encode(tokens: PlacedToken[]): SemanticTokens {
  const data: number[] = [];
  let lastLine = 0;
  let lastChar = 0;
  for (const token of tokens) {
    const deltaLine = token.line - lastLine;
    data.push(
      deltaLine,
      deltaLine === 0 ? token.character - lastChar : token.character,
      token.length,
      token.typeIndex,
      0,
    );
    lastLine = token.line;
    lastChar = token.character;
  }
  return { data };
}

/**
 * Every token of `[from, to)`, placed on its line.
 *
 * Lines come from the `EditorState`'s own document rather than from the text
 * again: it indexes them, so this is one lookup per token instead of a scan of
 * the program per token. Character offsets are UTF-16 code units on both sides,
 * which is what the protocol counts by default.
 *
 * A token spanning a line break is split at each one - the encoding is
 * line-relative, so a client cannot render one that is not.
 */
function place(state: EditorState, from: number, to: number): PlacedToken[] {
  const placed: PlacedToken[] = [];
  for (const token of tokensIn(state, from, to)) {
    const typeIndex = INDEX_OF_TYPE.get(TYPE_OF_TAG[token.kind] ?? '');
    if (typeIndex === undefined) continue;
    const first = state.doc.lineAt(token.from);
    const last = state.doc.lineAt(token.to);
    for (let number = first.number; number <= last.number; number++) {
      const line = number === first.number ? first : state.doc.line(number);
      const start = number === first.number ? token.from : line.from;
      const end = number === last.number ? token.to : line.to;
      if (end > start) {
        placed.push({
          line: number - 1,
          character: start - line.from,
          length: end - start,
          typeIndex,
        });
      }
    }
  }
  return placed;
}

/** A protocol position as a document offset, clamped to the program. */
function offsetOf(state: EditorState, position: Position): number {
  const number = Math.min(Math.max(position.line + 1, 1), state.doc.lines);
  const line = state.doc.line(number);
  return Math.min(line.from + Math.max(position.character, 0), line.to);
}

/**
 * Every token in the program, or null for a document with no machine to read it
 * by - `DocumentStore.editorState` has already declined to build a state for
 * one, and colour follows the binding rather than guessing at a machine.
 */
export function semanticTokensFor(
  state: EditorState | null,
): SemanticTokens | null {
  if (!state) return null;
  return encode(place(state, 0, state.doc.length));
}

/** The same, for one range of the program - what an editor showing one screen asks. */
export function semanticTokensForRangeOf(
  state: EditorState | null,
  range: Range,
): SemanticTokens | null {
  if (!state) return null;
  return encode(
    place(state, offsetOf(state, range.start), offsetOf(state, range.end)),
  );
}
