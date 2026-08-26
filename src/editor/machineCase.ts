// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Typing the case the machine has.
 *
 * While Strict characters is on and the target machine has no lower case at
 * all, the editor stops producing what it would only have to refuse: text
 * arrives upper case whichever route wrote it.
 *
 * What it must not touch is what the reader did not type as letters. That is
 * the same distinction {@link ../app/convertedCharacters} makes, and it is made
 * with the same walk ({@link ../dialects/sourceUnits}): a unit longer than one
 * source character is notation - an escape, a raw byte, a short keyword
 * spelling - and its letters are load-bearing.
 */
import {
  EditorState,
  Transaction,
  type Extension,
  type TransactionSpec,
} from '@codemirror/state';
import type { Dialect } from '../dialects/types';
import {
  sourceUnitContext,
  unitAt,
  type SourceUnitContext,
} from '../dialects/sourceUnits';
import { letterCaseFor } from '../dialects/letterCase';

/**
 * The walk context for a machine whose text should be forced upper case, or
 * null where it should be left exactly as typed.
 *
 * Keyed on the machine having no lower-case shape at all, not on whether its
 * encoding folds: the Sinclairs fold and the Atom preserves, and on both the
 * reader is writing for a display that can only draw capitals.
 */
export function upperCaseWalk(
  dialect: Dialect,
  strict: boolean,
): SourceUnitContext | null {
  if (!strict) return null;
  if (letterCaseFor(dialect.id)?.lowerCase !== 'none') return null;
  return sourceUnitContext(dialect);
}

/**
 * `inserted`, upper-cased, read as the continuation of `prefix` on its line.
 *
 * The prefix is what already stands before the insertion point, and it is
 * needed rather than convenient: a letter typed into the middle of `{white}`
 * is inside notation, and only a walk that starts at the beginning of the line
 * can tell. Text spanning several lines is walked a line at a time, each after
 * the first starting from column zero.
 */
export function upperCaseInsert(
  prefix: string,
  inserted: string,
  ctx: SourceUnitContext,
): string {
  const lines = inserted.split('\n');
  return lines
    .map((line, i) => upperCaseTail(i === 0 ? prefix : '', line, ctx))
    .join('\n');
}

/** `tail`, upper-cased, where the line it lands on already holds `prefix`. */
function upperCaseTail(
  prefix: string,
  tail: string,
  ctx: SourceUnitContext,
): string {
  if (tail === '') return tail;
  const line = prefix + tail;
  const out = [...line];
  let i = 0;
  while (i < line.length) {
    const partial = partialNotationEnd(line, i, ctx);
    if (partial !== null) {
      i = partial;
      continue;
    }
    const unit = unitAt(line, i, ctx);
    if (unit.kind === 'text' && i >= prefix.length) {
      const upper = out[i]!.toUpperCase();
      // A fold that lengthens the text (German ss) would move every column
      // after it, so leave those alone: this rewrites case, never character
      // count.
      if (upper.length === 1) out[i] = upper;
    }
    i += unit.length;
  }
  return out.slice(prefix.length).join('');
}

/**
 * Where a half-typed escape starting at `i` ends, or null where nothing there
 * opens one.
 *
 * A brace run is notation to the reader whether or not it is complete yet, and
 * that matters because the case inside several of these forms is load-bearing
 * in *both* directions: the Atom, TRS-80, Altair and Apple I spell a raw byte
 * `{0xNN}`, whose `x` must stay lower case and whose digits must stay upper.
 * Upper-casing a half-typed one as the reader types it would leave them with
 * `{0X41}`, which is not a byte on any machine here.
 *
 * So a brace the charset cannot yet read as one unit exempts everything up to
 * the next `}`, or to end of line where the reader has not typed one. The cost
 * is that an ordinary `{`...`}` run keeps its case on the machines whose
 * charset has a real brace character; those machines store what is written
 * either way, and where one would convert it the strict error still says so.
 */
function partialNotationEnd(
  line: string,
  i: number,
  ctx: SourceUnitContext,
): number | null {
  const opens = line[i] === '{' || (line[i] === '\\' && line[i + 1] === '{');
  if (!opens) return null;
  if (unitAt(line, i, ctx).kind === 'notation') return null;
  const close = line.indexOf('}', i);
  return close < 0 ? line.length : close + 1;
}

/**
 * Force upper case on every route that writes to the document.
 *
 * A transaction filter rather than a fourth copy of the per-seam rule beside
 * it: the editor's input seams do not converge - the `keydown` handler never
 * sees a paste, the native-mobile `inputHandler` sees typed text only, and the
 * on-screen keyboard emits no key events at all - and this is the one hook
 * every write passes through, both paste routes included.
 *
 * Gated on a user input event, so a document swap, an undo, or an AI merge
 * pushing text in is left exactly as it is: this changes what the reader types,
 * never what they already have.
 */
export function machineCaseFilter(
  dialect: Dialect,
  strict: boolean,
): Extension {
  const ctx = upperCaseWalk(dialect, strict);
  if (!ctx) return [];
  return EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged || !tr.isUserEvent('input')) return tr;
    const changes: { from: number; to: number; insert: string }[] = [];
    let changed = false;
    tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
      const text = inserted.toString();
      const line = tr.startState.doc.lineAt(fromA);
      const upper = upperCaseInsert(
        tr.startState.sliceDoc(line.from, fromA),
        text,
        ctx,
      );
      if (upper !== text) changed = true;
      changes.push({ from: fromA, to: toA, insert: upper });
    });
    if (!changed) return tr;
    // Rebuilt rather than mapped: the replacement is the same length as the
    // text it stands in for, so every selection and effect the transaction
    // carries still lands where it was going.
    return {
      changes,
      selection: tr.selection,
      effects: tr.effects,
      scrollIntoView: tr.scrollIntoView,
      userEvent: tr.annotation(Transaction.userEvent),
    } satisfies TransactionSpec;
  });
}
