// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { DocumentStore, offsetToPosition } from './documents';
import { composeHover, hoverAt } from './hover';

function hoverFor(dialectId: string, text: string, offset: number) {
  const store = new DocumentStore();
  store.open('file:///a.bas', text, 1, dialectId);
  const state = store.editorState('file:///a.bas')!;
  const doc = store.get('file:///a.bas')!;
  return hoverAt(doc, state, offsetToPosition(text, offset));
}

describe('composeHover', () => {
  it('still yields something for a keyword with no reference row', () => {
    const markup = composeHover('FROB', undefined, undefined);
    expect(markup).toContain('FROB');
  });

  it('prefers the reference page row when there is one', () => {
    const markup = composeHover(
      'PRINT',
      {
        name: 'PRINT',
        kind: 'command',
        syntax: 'PRINT <expr>',
        description: 'prints it',
      },
      { word: 'PRINT', kind: 'command', signature: 'ignored', doc: 'ignored' },
    );
    expect(markup).toContain('PRINT <expr>');
    expect(markup).toContain('prints it');
  });

  it("falls back to the dialect's own signature/doc with no reference row", () => {
    const markup = composeHover('PRINT', undefined, {
      word: 'PRINT',
      kind: 'command',
      signature: 'PRINT <expr>',
      doc: 'prints something',
    });
    expect(markup).toContain('PRINT <expr>');
    expect(markup).toContain('prints something');
  });
});

describe('hoverAt', () => {
  it("explains PRINT on commodore64: what it means and how it's written", async () => {
    const text = '10 PRINT "HI"';
    const hover = await hoverFor(
      'commodore64',
      text,
      text.indexOf('PRINT') + 1,
    );
    expect(hover).not.toBeNull();
    const markup = (hover!.contents as { value: string }).value;
    expect(markup).toContain('PRINT');
    expect(markup.length).toBeGreaterThan('PRINT'.length);
  });

  it('resolves a short spelling to the keyword it stands for', async () => {
    const text = '10 ?"HI"';
    const hover = await hoverFor('commodore64', text, text.indexOf('?'));
    expect(hover).not.toBeNull();
    const markup = (hover!.contents as { value: string }).value;
    expect(markup).toContain('PRINT');
  });

  it('gives nothing for a declined document', async () => {
    const hover = await hoverFor('nosuchbinding' as never, '', 0);
    expect(hover).toBeNull();
  });
});
