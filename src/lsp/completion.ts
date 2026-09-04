// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Completion, translated from the browser editor's own answer.
 *
 * `dialect.completionSource` already decides everything that matters: which
 * keywords and block constructs the machine has, whether the cursor sits
 * inside a string (nothing is offered there), and - on a crunched dialect -
 * where a completion accepted mid-run should really start
 * (`src/editor/completions.ts`'s re-anchoring). This module's whole job is
 * turning that CodeMirror `CompletionResult` into the protocol's shape;
 * nothing here is a second decision about what to offer.
 *
 * A construct's `apply` closure (`makeConstructApply` in
 * `src/editor/completions.ts`) drives an `EditorView` to number the lines it
 * expands - machinery this server has no view to run, and no need to: an
 * external editor owns its own line numbering. So a construct is looked back
 * up in `constructsByDialect` by its label and inserted as the plain
 * (un-numbered) snippet `src/editor/constructs.ts` already writes in the
 * protocol's own syntax - the same fallback `makeConstructApply` itself takes
 * when auto-numbering is off.
 */
import { CompletionContext } from '@codemirror/autocomplete';
import type { EditorState } from '@codemirror/state';
import {
  CompletionItemKind,
  InsertTextFormat,
  type CompletionItem,
  type Position,
} from 'vscode-languageserver';
import { constructsByDialect } from '../editor/constructs';
import type { OpenDocument } from './documents';
import { offsetToPosition, positionToOffset } from './documents';

const KIND_BY_TYPE: Record<string, CompletionItemKind> = {
  keyword: CompletionItemKind.Keyword,
  function: CompletionItemKind.Function,
  operator: CompletionItemKind.Operator,
  variable: CompletionItemKind.Variable,
};

/**
 * Completions offered at `position` in `doc`, whose `state` is the document's
 * own headless `EditorState` (see {@link DocumentStore.editorState}). Empty
 * for a document with no binding, or wherever the dialect's own source offers
 * nothing - inside a string, or with no prefix and no explicit request.
 */
export async function completionsAt(
  doc: OpenDocument,
  state: EditorState,
  position: Position,
): Promise<CompletionItem[]> {
  if (doc.binding.kind !== 'bound') return [];
  const dialect = doc.binding.dialect;
  const pos = positionToOffset(doc.text, position);
  const context = new CompletionContext(state, pos, true);
  // A CompletionSource may answer synchronously or asynchronously; every
  // dialect here answers synchronously, but `await`ing a plain value resolves
  // immediately, so this reads correctly either way.
  const result = await dialect.completionSource(context);
  if (!result) return [];

  const constructs = constructsByDialect[dialect.id] ?? [];
  const constructByLabel = new Map(constructs.map((c) => [c.label, c]));

  // One anchor for the whole result, exactly as CodeMirror's own consumers
  // read it - the crunch re-anchoring already moved `result.from` for a mid-run
  // completion, so every option replaces the same (possibly shortened) range.
  const range = {
    start: offsetToPosition(doc.text, result.from),
    end: offsetToPosition(doc.text, result.to ?? pos),
  };

  return result.options.map((option): CompletionItem => {
    const construct =
      typeof option.apply === 'function'
        ? constructByLabel.get(option.label)
        : undefined;
    const insertText = construct ? construct.lines.join('\n') : option.label;
    return {
      label: option.label,
      kind: KIND_BY_TYPE[option.type ?? ''] ?? CompletionItemKind.Text,
      detail: option.detail,
      documentation: typeof option.info === 'string' ? option.info : undefined,
      insertTextFormat: construct
        ? InsertTextFormat.Snippet
        : InsertTextFormat.PlainText,
      textEdit: { range, newText: insertText },
    };
  });
}
