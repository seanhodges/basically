// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { beforeEach, describe, expect, it } from 'vitest';
import { history, undo, undoDepth } from '@codemirror/commands';
import { EditorState, EditorSelection } from '@codemirror/state';
import {
  basicBufferKey,
  blockBufferKey,
  bufferHistories,
  freshBufferState,
} from './bufferHistory';

const extensions = [history()];

/** A state that has been typed into, so it has something to undo. */
function edited(text: string, appended: string): EditorState {
  const state = freshBufferState(text, extensions);
  return state.update({
    changes: { from: state.doc.length, insert: appended },
    selection: { anchor: state.doc.length + appended.length },
  }).state;
}

/** Apply a `StateCommand` off-view and hand back the resulting state. */
function applyUndo(state: EditorState): EditorState {
  let next = state;
  undo({ state, dispatch: (tr) => (next = tr.state) });
  return next;
}

describe('bufferHistories', () => {
  beforeEach(() => {
    bufferHistories.clear();
  });

  it('round-trips document, selection and undo depth', () => {
    const state = edited('10 REM one', '\n20 REM two');
    expect(undoDepth(state)).toBe(1);

    bufferHistories.save('a', state);
    const back = bufferHistories.restore('a', 'ignored', extensions);
    expect(back.doc.toString()).toBe('10 REM one\n20 REM two');
    expect(back.selection.main.head).toBe(state.selection.main.head);
    expect(undoDepth(back)).toBe(1);
  });

  it('undoes a restored state back to its own prior text', () => {
    bufferHistories.save('a', edited('10 REM one', '\n20 REM two'));
    const back = bufferHistories.restore('a', 'ignored', extensions);
    expect(applyUndo(back).doc.toString()).toBe('10 REM one');
  });

  it('keeps each key to its own history', () => {
    bufferHistories.save('a', edited('program', ' edited'));
    bufferHistories.save('b', edited('snippet', ' typed'));

    const a = bufferHistories.restore('a', '', extensions);
    const b = bufferHistories.restore('b', '', extensions);
    expect(applyUndo(a).doc.toString()).toBe('program');
    expect(applyUndo(b).doc.toString()).toBe('snippet');
  });

  it('falls back to the buffer text when there is no snapshot', () => {
    const back = bufferHistories.restore('missing', '10 REM live', extensions);
    expect(back.doc.toString()).toBe('10 REM live');
    expect(undoDepth(back)).toBe(0);
  });

  it('falls back rather than throwing on a corrupt snapshot', () => {
    // Reaches past the API to plant a snapshot no `fromJSON` can read: the
    // point is that a switch costs the history, never the buffer.
    (
      bufferHistories as unknown as { snapshots: Map<string, unknown> }
    ).snapshots.set('a', { doc: 42, selection: 'nonsense' });
    const back = bufferHistories.restore('a', '10 REM live', extensions);
    expect(back.doc.toString()).toBe('10 REM live');
  });

  it('drops one key and clears the rest', () => {
    bufferHistories.save('a', freshBufferState('a', extensions));
    bufferHistories.save('b', freshBufferState('b', extensions));

    bufferHistories.drop('a');
    expect(bufferHistories.has('a')).toBe(false);
    expect(bufferHistories.has('b')).toBe(true);

    const before = bufferHistories.generation;
    bufferHistories.clear();
    expect(bufferHistories.has('b')).toBe(false);
    expect(bufferHistories.generation).toBe(before + 1);
  });

  it('restoring takes the snapshot out of the cache', () => {
    bufferHistories.save('a', freshBufferState('a', extensions));
    bufferHistories.restore('a', 'a', extensions);
    expect(bufferHistories.has('a')).toBe(false);
  });

  it('keys the program, scratch buffers and blocks apart', () => {
    const keys = [
      basicBufferKey(null),
      basicBufferKey('scratch-1'),
      blockBufferKey('scratch-1'),
      blockBufferKey('block-border'),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('serializes a multi-range selection with the document', () => {
    const state = freshBufferState('10 REM one\n20 REM two', extensions).update(
      {
        selection: EditorSelection.single(3, 6),
      },
    ).state;
    bufferHistories.save('a', state);
    const back = bufferHistories.restore('a', '', extensions);
    expect(back.selection.main.from).toBe(3);
    expect(back.selection.main.to).toBe(6);
  });
});
