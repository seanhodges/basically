// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  DocumentStore,
  errorToRange,
  offsetToPosition,
  positionToOffset,
} from './documents';

describe('offsetToPosition / positionToOffset', () => {
  it('round-trips across lines, including the last line with no trailing newline', () => {
    const text = '10 PRINT "HI"\n20 GOTO 10\n30 END';
    for (let offset = 0; offset <= text.length; offset++) {
      const pos = offsetToPosition(text, offset);
      expect(positionToOffset(text, pos), `offset ${offset}`).toBe(offset);
    }
    // The end of the last line, which has no trailing newline of its own.
    expect(offsetToPosition(text, text.length)).toEqual({
      line: 2,
      character: '30 END'.length,
    });
  });

  it('places the start of each line at character 0', () => {
    const text = 'A\nBB\nCCC';
    expect(offsetToPosition(text, 0)).toEqual({ line: 0, character: 0 });
    expect(offsetToPosition(text, 2)).toEqual({ line: 1, character: 0 });
    expect(offsetToPosition(text, 5)).toEqual({ line: 2, character: 0 });
  });
});

describe('errorToRange', () => {
  const text = '10 PRINT "HI\n20 LET A=1: PRINT A';

  it('places a fatal error with a known column and no endColumn at end of line', () => {
    const range = errorToRange(text, {
      line: 1,
      column: 10,
      fatal: true,
    } as never);
    expect(range).toEqual({
      start: { line: 0, character: 10 },
      end: { line: 0, character: '10 PRINT "HI'.length },
    });
  });

  it('treats an absent column as 0', () => {
    const range = errorToRange(text, { line: 2 } as never);
    expect(range.start).toEqual({ line: 1, character: 0 });
  });

  it('honours an explicit endColumn', () => {
    const range = errorToRange(text, {
      line: 2,
      column: 4,
      endColumn: 5,
    } as never);
    expect(range).toEqual({
      start: { line: 1, character: 4 },
      end: { line: 1, character: 5 },
    });
  });
});

describe('DocumentStore', () => {
  it('binds on open and does not re-bind on update', () => {
    const store = new DocumentStore();
    const doc = store.open('file:///a.bas', '10 PRINT "HI"', 1, 'zx81');
    expect(doc.binding).toMatchObject({ kind: 'bound', source: 'configured' });

    // A declared machine would normally win, but update() must not re-decide
    // the binding - only rebindAll() does that.
    const updated = store.update(
      'file:///a.bas',
      '#MACHINE commodore64\n10 PRINT "HI"',
      2,
    );
    expect(updated?.binding).toMatchObject({
      kind: 'bound',
      source: 'configured',
    });
    expect((updated!.binding as { dialect: { id: string } }).dialect.id).toBe(
      'zx81',
    );
  });

  it('rebindAll re-decides every open document', () => {
    const store = new DocumentStore();
    store.open('file:///a.bas', '10 PRINT "HI"', 1, 'zx81');
    const [rebound] = store.rebindAll('commodore64');
    expect((rebound!.binding as { dialect: { id: string } }).dialect.id).toBe(
      'commodore64',
    );
  });

  it('caches the EditorState per (version, dialect id)', () => {
    const store = new DocumentStore();
    store.open('file:///a.bas', '10 PRINT "HI"', 1, 'zx81');
    const first = store.editorState('file:///a.bas');
    const second = store.editorState('file:///a.bas');
    expect(first).toBe(second);

    store.update('file:///a.bas', '10 PRINT "BYE"', 2);
    const third = store.editorState('file:///a.bas');
    expect(third).not.toBe(first);
  });

  it('gives no EditorState for a declined document', () => {
    const store = new DocumentStore();
    store.open('file:///a.bas', '', 1, undefined);
    expect(store.editorState('file:///a.bas')).toBeNull();
  });
});
