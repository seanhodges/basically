// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The program's structure, as document symbols: `buildOutline` already
 * decides what the machine has to show - procedures, functions and the lines
 * jumped to - gated on the same `outlineCapabilities` the IDE's own outline
 * panel uses, so a Sinclair program is never asked to show a procedure it
 * cannot have. A procedure or function's range comes from its `ProcRegion`
 * when `collectVariables` finds one (the whole body, not just its header
 * line); everything else - a subroutine or GOTO target, which has no body of
 * its own - is the one line it names.
 */
import type { DocumentSymbol, Position, Range } from 'vscode-languageserver';
import { SymbolKind } from 'vscode-languageserver';
import {
  buildOutline,
  findRowForLineNumber,
  outlineCapabilities,
  type OutlineKind,
} from '../editor/programOutline';
import { collectVariables } from '../editor/variables';
import { variableRulesFor } from '../editor/variableLexis';
import type { OpenDocument } from './documents';

function symbolKind(kind: OutlineKind): SymbolKind {
  switch (kind) {
    case 'procedure':
    case 'function':
      return SymbolKind.Function;
    case 'subroutine':
      return SymbolKind.Method;
    case 'goto':
      return SymbolKind.Constant;
  }
}

/** The single-line range of the physical row bearing BASIC line `lineNo`, or null. */
function lineRange(text: string, lineNo: number): Range | null {
  const row = findRowForLineNumber(text, lineNo);
  if (row === null) return null;
  const start: Position = { line: row - 1, character: 0 };
  const lineText = text.split('\n')[row - 1] ?? '';
  return { start, end: { line: row - 1, character: lineText.length } };
}

/** The program's structure, or `[]` for an unbound document. */
export function documentSymbols(doc: OpenDocument): DocumentSymbol[] {
  if (doc.binding.kind !== 'bound') return [];
  const dialect = doc.binding.dialect;
  const caps = outlineCapabilities(dialect.keywords);
  const rules = variableRulesFor(dialect.id, dialect.keywords);
  const procs = collectVariables(doc.text, rules, caps).procs;

  const symbols: DocumentSymbol[] = [];
  for (const section of buildOutline(doc.text, caps)) {
    for (const item of section.items) {
      const region = procs.find((p) => p.name === item.title);
      const range: Range | null = region
        ? {
            start: { line: region.startRow, character: 0 },
            end: {
              line: region.endRow,
              character: (doc.text.split('\n')[region.endRow] ?? '').length,
            },
          }
        : lineRange(doc.text, item.lineNo);
      if (!range) continue;
      symbols.push({
        name: item.title,
        kind: symbolKind(item.kind),
        range,
        selectionRange: range,
      });
    }
  }
  return symbols;
}
