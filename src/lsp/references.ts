// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Every use of the variable under the cursor, as protocol locations and
 * document highlights - two protocol methods over the one answer
 * `findVariableUsages` already gives, converting its document offsets through
 * the document store's position conversion.
 */
import type { DocumentHighlight, Position, Range } from 'vscode-languageserver';
import { findVariableUsages } from '../editor/variableUsages';
import { offsetToPosition, positionToOffset } from './documents';
import type { OpenDocument } from './documents';

/** Every use of the variable at `position`, as document ranges - `[]` when there isn't one. */
export function referencesAt(doc: OpenDocument, position: Position): Range[] {
  if (doc.binding.kind !== 'bound') return [];
  const dialect = doc.binding.dialect;
  const offset = positionToOffset(doc.text, position);
  const usages = findVariableUsages(
    doc.text,
    dialect.id,
    dialect.keywords,
    offset,
  );
  if (!usages) return [];
  return usages.ranges.map((r) => ({
    start: offsetToPosition(doc.text, r.from),
    end: offsetToPosition(doc.text, r.to),
  }));
}

/** The same usages as {@link referencesAt}, wrapped as document highlights. */
export function documentHighlightsAt(
  doc: OpenDocument,
  position: Position,
): DocumentHighlight[] {
  return referencesAt(doc, position).map((range) => ({ range }));
}
