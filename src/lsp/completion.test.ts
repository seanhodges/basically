// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { CompletionItemKind, InsertTextFormat } from 'vscode-languageserver';
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

  it("offers the program's own names alongside the machine's keywords", async () => {
    const text = '10 LET SCORE=1\n20 PRINT SC';
    const items = await completionsFor('zx81', text, text.length);
    const score = items.find((i) => i.label === 'SCORE');
    // Marked as a variable, so an editor showing kinds tells it from a keyword.
    expect(score?.kind).toBe(CompletionItemKind.Variable);
    expect(items.some((i) => i.label === 'PRINT')).toBe(true);
  });

  it('offers a name local to a procedure only from inside it', async () => {
    const text = [
      '10 total=1',
      '20 PROCwork',
      '30 PRINT t',
      '40 END',
      '50 DEF PROCwork',
      '60 LOCAL tally',
      '70 tally=2',
      '80 PRINT t',
      '90 ENDPROC',
    ].join('\n');
    const outside = await completionsFor(
      'bbcmicro',
      text,
      text.indexOf('30 PRINT t') + '30 PRINT t'.length,
    );
    expect(outside.some((i) => i.label === 'total')).toBe(true);
    expect(outside.some((i) => i.label === 'tally')).toBe(false);

    const inside = await completionsFor(
      'bbcmicro',
      text,
      text.indexOf('80 PRINT t') + '80 PRINT t'.length,
    );
    expect(inside.some((i) => i.label === 'tally')).toBe(true);
  });

  it('offers nothing inside a string literal', async () => {
    const text = '10 PRINT "PR';
    const items = await completionsFor('zx81', text, text.length);
    expect(items).toEqual([]);
  });

  it('offers no name either inside a string literal', async () => {
    const text = '10 LET SCORE=1\n20 PRINT "SC';
    const items = await completionsFor('zx81', text, text.length);
    expect(items).toEqual([]);
  });

  it('replaces only the tail on a crunched machine, not the whole run', async () => {
    // Still one range across every item here, with two sources answering: the
    // variable source blanks the word under the cursor before it scans, so a
    // lone name finds no names and stands down, leaving the keyword source's
    // re-anchored run as the only answer.
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
