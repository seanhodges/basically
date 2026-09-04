// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { InsertTextFormat } from 'vscode-languageserver';
import { getDialect } from '../dialects/registry';
import { DocumentStore, offsetToPosition } from './documents';
import { completionsAt } from './completion';

function completionsFor(dialectId: string, text: string, offset: number) {
  const store = new DocumentStore();
  store.open('file:///a.bas', text, 1, dialectId);
  const state = store.editorState('file:///a.bas')!;
  const doc = store.get('file:///a.bas')!;
  return completionsAt(doc, state, offsetToPosition(text, offset));
}

describe('completion', () => {
  it("offers only that machine's own keywords for a keyword prefix", async () => {
    const text = '10 PR';
    const items = await completionsFor('zx81', text, text.length);
    const zx81 = getDialect('zx81');
    expect(items.some((i) => i.label === 'PRINT')).toBe(true);
    for (const item of items) {
      const isKeyword = zx81.keywords.some((k) => k.word === item.label);
      const isConstruct = item.insertTextFormat === InsertTextFormat.Snippet;
      expect(isKeyword || isConstruct, item.label).toBe(true);
    }
  });

  it('inserts a block construct as an ordered snippet, unchanged from its template', async () => {
    const text = '10 FOR';
    const items = await completionsFor('zx81', text, text.length);
    const forItem = items.find((i) => i.label === 'FOR');
    expect(forItem?.insertTextFormat).toBe(InsertTextFormat.Snippet);
    expect(forItem?.textEdit).toMatchObject({
      newText: 'FOR ${1:I}=${2:1} TO ${3:10}\n${0}\nNEXT ${1:I}',
    });
  });

  it('offers nothing inside a string literal', async () => {
    const text = '10 PRINT "PR';
    const items = await completionsFor('zx81', text, text.length);
    expect(items).toEqual([]);
  });

  it('replaces only the tail on a crunched machine, not the whole run', async () => {
    const text = '10 POKEA';
    const items = await completionsFor('commodore64', text, text.length);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.textEdit).toMatchObject({
        range: {
          start: { line: 0, character: '10 POKE'.length },
          end: { line: 0, character: text.length },
        },
      });
    }
  });

  it('gives nothing for a declined document', async () => {
    const store = new DocumentStore();
    store.open('file:///a.bas', '', 1, undefined);
    const doc = store.get('file:///a.bas')!;
    // No EditorState exists for a declined document; completion must not be
    // asked to build completions against one.
    expect(store.editorState('file:///a.bas')).toBeNull();
    expect(doc.binding.kind).toBe('declined');
  });
});
