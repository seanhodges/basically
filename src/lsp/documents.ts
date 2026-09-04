// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The server's open-document bookkeeping: what an editor has open, which
 * machine each is bound to, and the headless `EditorState` the rest of the
 * server asks its questions of.
 *
 * Everything here is a plain function of a document's own text and version -
 * no transport, no protocol connection - so `src/lsp/handlers.ts` can be
 * driven from a unit test the same way `src/cli/*.ts` already is.
 */
import { EditorState } from '@codemirror/state';
import type { Position, Range } from 'vscode-languageserver';
import type { TokenizeError } from '../dialects/types';
import { bindMachine, type MachineBinding } from './binding';

export interface OpenDocument {
  uri: string;
  text: string;
  version: number;
  binding: MachineBinding;
}

interface CachedState {
  version: number;
  dialectId: string;
  state: EditorState;
}

/**
 * Open documents, keyed by URI. A document's binding is decided when it opens
 * and stays put across keystrokes - {@link DocumentStore.update} never
 * re-binds - because inference is a listing-shape question, not a
 * per-edit one, and re-deciding it on every keystroke would make a document's
 * machine flicker while the user is mid-edit. {@link DocumentStore.rebindAll}
 * is the one place a binding changes after opening, for when the user
 * reconfigures which machine to use.
 */
export class DocumentStore {
  private readonly docs = new Map<string, OpenDocument>();
  private readonly stateCache = new Map<string, CachedState>();

  open(
    uri: string,
    text: string,
    version: number,
    configuredMachine: string | undefined,
  ): OpenDocument {
    const doc: OpenDocument = {
      uri,
      text,
      version,
      binding: bindMachine(text, configuredMachine),
    };
    this.docs.set(uri, doc);
    return doc;
  }

  /** Apply a full-text change to an already-open document; a no-op for one that isn't. */
  update(uri: string, text: string, version: number): OpenDocument | undefined {
    const existing = this.docs.get(uri);
    if (!existing) return undefined;
    const doc: OpenDocument = { ...existing, text, version };
    this.docs.set(uri, doc);
    return doc;
  }

  close(uri: string): void {
    this.docs.delete(uri);
    this.stateCache.delete(uri);
  }

  get(uri: string): OpenDocument | undefined {
    return this.docs.get(uri);
  }

  all(): OpenDocument[] {
    return [...this.docs.values()];
  }

  /**
   * Re-bind every open document against a newly configured machine - the
   * server's answer to "the user changed which machine is chosen" - and
   * return every document so the caller can re-publish diagnostics for all
   * of them, bound or declined alike.
   */
  rebindAll(configuredMachine: string | undefined): OpenDocument[] {
    for (const [uri, doc] of this.docs) {
      this.docs.set(uri, {
        ...doc,
        binding: bindMachine(doc.text, configuredMachine),
      });
    }
    return this.all();
  }

  /**
   * The `EditorState` for a bound document, built from its dialect's own
   * `languageSupport()` - the same extension the browser editor runs - and
   * cached per `(version, dialect id)` so a keystroke does not rebuild it
   * twice. Null for a document with no binding to build one from.
   */
  editorState(uri: string): EditorState | null {
    const doc = this.docs.get(uri);
    if (!doc || doc.binding.kind !== 'bound') return null;
    const dialectId = doc.binding.dialect.id;
    const cached = this.stateCache.get(uri);
    if (
      cached &&
      cached.version === doc.version &&
      cached.dialectId === dialectId
    ) {
      return cached.state;
    }
    const state = EditorState.create({
      doc: doc.text,
      extensions: [doc.binding.dialect.languageSupport()],
    });
    this.stateCache.set(uri, { version: doc.version, dialectId, state });
    return state;
  }
}

/** Offset of the start of each line of `text`. */
function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) {
    starts.push(i + 1);
  }
  return starts;
}

/** A document offset as a 0-based line/character protocol {@link Position}. */
export function offsetToPosition(text: string, offset: number): Position {
  const starts = lineStarts(text);
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid]! <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo, character: offset - starts[lo]! };
}

/** A protocol {@link Position} as a document offset, the inverse of {@link offsetToPosition}. */
export function positionToOffset(text: string, position: Position): number {
  const starts = lineStarts(text);
  const lineStart = starts[position.line] ?? text.length;
  return lineStart + position.character;
}

/**
 * A {@link TokenizeError} as a protocol {@link Range}: `error.line` is
 * 1-based, `error.column` 0-based and optional (treated as 0, as
 * `src/editor/lintIntegration.ts` treats it), and an absent `endColumn` runs
 * to the end of the line - the same convention that module already follows,
 * just against line text instead of document offsets.
 */
export function errorToRange(
  text: string,
  error: Pick<TokenizeError, 'line' | 'column' | 'endColumn'>,
): Range {
  const lines = text.split('\n');
  const lineIndex = Math.min(Math.max(error.line - 1, 0), lines.length - 1);
  const lineText = lines[lineIndex] ?? '';
  const startChar = Math.min(Math.max(error.column ?? 0, 0), lineText.length);
  const endChar =
    error.endColumn !== undefined
      ? Math.min(Math.max(error.endColumn, 0), lineText.length)
      : lineText.length;
  return {
    start: { line: lineIndex, character: startChar },
    end: { line: lineIndex, character: Math.max(startChar, endChar) },
  };
}
