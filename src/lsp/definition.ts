// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Where a destination named at the cursor is defined: a `GOTO`/`GOSUB`/`THEN`
 * (etc.) line reference to the line bearing that number, or a `PROCfoo`/
 * `FNfoo` call to where that procedure or function is defined.
 *
 * No new analysis - both answers are the editor's own. A line reference is
 * exactly what `src/editor/lineNumbering.ts` already recognises for
 * renumbering, resolved with the same `findRowForLineNumber` the outline
 * jumps with; a procedure or function call resolves against
 * `collectVariables(...).procs`, whose `ProcRegion` already carries the name
 * and where it starts.
 */
import type { Position } from 'vscode-languageserver';
import { lineNumberReferenceAt } from '../editor/lineNumbering';
import {
  findRowForLineNumber,
  outlineCapabilities,
  scannable,
} from '../editor/programOutline';
import { collectVariables } from '../editor/variables';
import { variableRulesFor } from '../editor/variableLexis';
import type { OpenDocument } from './documents';

/** A `PROCfoo`/`FNfoo` call, in the machine's own spelling, at whole-run boundaries. */
const CALL_RE = /\b(PROC|FN)([A-Za-z0-9_]+)/g;

/** The full call name (`"PROCfoo"`/`"FNfoo"`) covering column `col`, or null. */
function callAt(
  lineText: string,
  col: number,
  hasProc: boolean,
  hasFn: boolean,
): string | null {
  const scan = scannable(lineText);
  for (const m of scan.matchAll(CALL_RE)) {
    const prefix = m[1]!.toUpperCase();
    if (prefix === 'PROC' && !hasProc) continue;
    if (prefix === 'FN' && !hasFn) continue;
    const start = m.index;
    const end = start + m[0].length;
    if (col >= start && col <= end) return `${m[1]}${m[2]}`;
  }
  return null;
}

/**
 * The definition location for what is named at `position`, or null - either
 * because nothing nameable sits there, or because it names a line no line in
 * the program has (which reaches nowhere rather than somewhere near).
 */
export function definitionAt(
  doc: OpenDocument,
  position: Position,
): Position | null {
  if (doc.binding.kind !== 'bound') return null;
  const dialect = doc.binding.dialect;
  const lineText = doc.text.split('\n')[position.line] ?? '';

  const lineNo = lineNumberReferenceAt(lineText, position.character);
  if (lineNo !== null) {
    const row = findRowForLineNumber(doc.text, lineNo);
    return row === null ? null : { line: row - 1, character: 0 };
  }

  const caps = outlineCapabilities(dialect.keywords);
  const callName = callAt(
    lineText,
    position.character,
    caps.hasProc,
    caps.hasFn,
  );
  if (callName === null) return null;

  const rules = variableRulesFor(dialect.id, dialect.keywords);
  const region = collectVariables(doc.text, rules, caps).procs.find(
    (p) => p.name === callName,
  );
  return region ? { line: region.startRow, character: 0 } : null;
}
