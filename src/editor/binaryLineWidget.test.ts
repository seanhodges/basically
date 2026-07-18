// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { binaryLineDecorations } from './binaryLineWidget';
import { formatBinaryDirective } from '../dialects/binaryDirective';

const record = Uint8Array.from([0x00, 0x00, 0x03, 0x00, 0xea, 0xcd, 0x76]);

describe('binaryLineDecorations', () => {
  it('replaces each well-formed #BIN line', () => {
    const doc = [
      formatBinaryDirective(record),
      '10 PRINT "HI"',
      formatBinaryDirective(record),
    ].join('\n');
    const state = EditorState.create({ doc });
    const deco = binaryLineDecorations(state);
    expect(deco.size).toBe(2);

    // Each decoration spans exactly its whole line.
    const spans: Array<[number, number]> = [];
    const cursor = deco.iter();
    while (cursor.value) {
      spans.push([cursor.from, cursor.to]);
      cursor.next();
    }
    expect(spans).toEqual([
      [state.doc.line(1).from, state.doc.line(1).to],
      [state.doc.line(3).from, state.doc.line(3).to],
    ]);
  });

  it('leaves malformed directives and ordinary lines undecorated', () => {
    const state = EditorState.create({
      doc: '#BIN not-base64!\n10 PRINT "HI"\n',
    });
    expect(binaryLineDecorations(state).size).toBe(0);
  });
});
