// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * One entry point per protocol method the server answers, each taking the
 * document store and the request's own parameters and returning the
 * protocol's result. No `process`, no transport, no connection object - the
 * same split `src/cli/*.ts` keeps from `scripts/headless/cli.mts`, so every
 * answer here is unit-testable without a stream to feed it and
 * `scripts/headless/lsp.mts` is left holding only the wiring.
 */
import type {
  CompletionItem,
  Diagnostic,
  DocumentHighlight,
  DocumentSymbol,
  Hover,
  Location,
  Position,
} from 'vscode-languageserver';
import { DocumentStore, type OpenDocument } from './documents';
import { diagnosticsFor } from './diagnostics';
import { completionsAt } from './completion';
import { hoverAt } from './hover';
import { definitionAt } from './definition';
import { documentSymbols } from './symbols';
import { documentHighlightsAt, referencesAt } from './references';

export function openDocument(
  store: DocumentStore,
  uri: string,
  text: string,
  version: number,
  configuredMachine: string | undefined,
): OpenDocument {
  return store.open(uri, text, version, configuredMachine);
}

export function changeDocument(
  store: DocumentStore,
  uri: string,
  text: string,
  version: number,
): OpenDocument | undefined {
  return store.update(uri, text, version);
}

export function closeDocument(store: DocumentStore, uri: string): void {
  store.close(uri);
}

/** Every open document whose binding changed - the caller re-publishes diagnostics for each. */
export function rebindAllDocuments(
  store: DocumentStore,
  configuredMachine: string | undefined,
): OpenDocument[] {
  return store.rebindAll(configuredMachine);
}

export function diagnosticsForDocument(doc: OpenDocument): Diagnostic[] {
  return diagnosticsFor(doc.text, doc.binding);
}

export async function completionAtPosition(
  store: DocumentStore,
  uri: string,
  position: Position,
): Promise<CompletionItem[]> {
  const doc = store.get(uri);
  const state = doc && store.editorState(uri);
  if (!doc || !state) return [];
  return completionsAt(doc, state, position);
}

export async function hoverAtPosition(
  store: DocumentStore,
  uri: string,
  position: Position,
): Promise<Hover | null> {
  const doc = store.get(uri);
  const state = doc && store.editorState(uri);
  if (!doc || !state) return null;
  return hoverAt(doc, state, position);
}

export function definitionAtPosition(
  store: DocumentStore,
  uri: string,
  position: Position,
): Location | null {
  const doc = store.get(uri);
  if (!doc) return null;
  const target = definitionAt(doc, position);
  return target ? { uri, range: { start: target, end: target } } : null;
}

export function symbolsForDocument(
  store: DocumentStore,
  uri: string,
): DocumentSymbol[] {
  const doc = store.get(uri);
  return doc ? documentSymbols(doc) : [];
}

export function referencesForPosition(
  store: DocumentStore,
  uri: string,
  position: Position,
): Location[] {
  const doc = store.get(uri);
  if (!doc) return [];
  return referencesAt(doc, position).map((range) => ({ uri, range }));
}

export function highlightsForPosition(
  store: DocumentStore,
  uri: string,
  position: Position,
): DocumentHighlight[] {
  const doc = store.get(uri);
  if (!doc) return [];
  return documentHighlightsAt(doc, position);
}
