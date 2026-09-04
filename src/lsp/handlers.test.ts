// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { DiagnosticSeverity } from 'vscode-languageserver';
import { DocumentStore } from './documents';
import {
  changeDocument,
  closeDocument,
  completionAtPosition,
  definitionAtPosition,
  diagnosticsForDocument,
  highlightsForPosition,
  hoverAtPosition,
  openDocument,
  rebindAllDocuments,
  referencesForPosition,
  symbolsForDocument,
} from './handlers';

const URI = 'file:///a.bas';

describe('handlers, wired to a DocumentStore', () => {
  it('opens, diagnoses, changes and closes a document', () => {
    const store = new DocumentStore();
    const doc = openDocument(store, URI, '10 PRINT "HI\n', 1, 'zx81');
    expect(diagnosticsForDocument(doc)[0]!.severity).toBe(
      DiagnosticSeverity.Error,
    );

    const changed = changeDocument(store, URI, '10 PRINT "HI"\n', 2);
    expect(diagnosticsForDocument(changed!)).toEqual([]);

    closeDocument(store, URI);
    expect(store.get(URI)).toBeUndefined();
  });

  it('rebinds every open document on a configuration change', () => {
    const store = new DocumentStore();
    openDocument(store, URI, '10 PRINT "HI"\n', 1, 'zx81');
    const [rebound] = rebindAllDocuments(store, 'commodore64');
    expect((rebound!.binding as { dialect: { id: string } }).dialect.id).toBe(
      'commodore64',
    );
  });

  it('answers completion, hover, definition, symbols and references through the store', async () => {
    const store = new DocumentStore();
    openDocument(
      store,
      URI,
      '10 GOSUB 100\n100 PRINT "HI"\n110 RETURN\n',
      1,
      'zx81',
    );

    const completions = await completionAtPosition(store, URI, {
      line: 0,
      character: 3,
    });
    expect(completions.length).toBeGreaterThan(0);

    const hover = await hoverAtPosition(store, URI, { line: 1, character: 4 });
    expect(hover).not.toBeNull();

    const definition = definitionAtPosition(store, URI, {
      line: 0,
      character: 9,
    });
    expect(definition).toEqual({
      uri: URI,
      range: {
        start: { line: 1, character: 0 },
        end: { line: 1, character: 0 },
      },
    });

    const symbols = symbolsForDocument(store, URI);
    expect(symbols.length).toBeGreaterThan(0);

    const refs = referencesForPosition(store, URI, { line: 1, character: 3 });
    expect(refs).toEqual([]); // "PRINT" is a keyword, not a variable

    const highlights = highlightsForPosition(store, URI, {
      line: 1,
      character: 3,
    });
    expect(highlights).toEqual([]);
  });

  it('gives empty/null answers for a document that was never opened', async () => {
    const store = new DocumentStore();
    const position = { line: 0, character: 0 };
    expect(await completionAtPosition(store, URI, position)).toEqual([]);
    expect(await hoverAtPosition(store, URI, position)).toBeNull();
    expect(definitionAtPosition(store, URI, position)).toBeNull();
    expect(symbolsForDocument(store, URI)).toEqual([]);
    expect(referencesForPosition(store, URI, position)).toEqual([]);
    expect(highlightsForPosition(store, URI, position)).toEqual([]);
  });
});
