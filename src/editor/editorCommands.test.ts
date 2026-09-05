// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The view-generic Edit-menu commands.
 *
 * The suite runs without a DOM, so the commands are driven against a stand-in
 * for the parts of `EditorView` they touch - the state, the dispatch and the
 * focus call. That is the whole of their contact with the view: what a real
 * browser adds (a rendered find panel, a genuine clipboard) is exercised in
 * `e2e/code-editor/editor-shortcuts.spec.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { history } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { Transaction, TransactionSpec } from '@codemirror/state';
import { runViewEditorCommand, isViewEditorCommand } from './editorCommands';

interface FakeView {
  text(): string;
  focused: number;
  transactions: number;
}

/** A view stand-in over a real `EditorState`, applying whatever is dispatched. */
function fakeView(doc: string, edits: string[] = []): FakeView {
  let state = EditorState.create({ doc, extensions: [history()] });
  for (const insert of edits) {
    state = state.update({
      changes: { from: state.doc.length, insert },
      selection: { anchor: state.doc.length + insert.length },
    }).state;
  }
  const fake = {
    get state() {
      return state;
    },
    dispatch(...specs: (Transaction | TransactionSpec)[]) {
      fake.transactions++;
      const first = specs[0];
      // `EditorView.dispatch` takes either a built transaction (undo/redo hand
      // one over, annotations and all) or transaction specs to merge.
      state =
        first && 'state' in first
          ? first.state
          : state.update(...(specs as TransactionSpec[])).state;
    },
    focus() {
      fake.focused++;
    },
    focused: 0,
    transactions: 0,
    text: () => state.doc.toString(),
  };
  return fake as unknown as FakeView;
}

/** The stand-in as the commands take it. */
const asView = (fake: FakeView): EditorView => fake as unknown as EditorView;

/** Clipboard doubles: what the async API returns, and whether the fallback works. */
let clipboardText: string | null;
let writeRejects: boolean;
let execCommandCopies: boolean;
let alerts: string[];

beforeEach(() => {
  clipboardText = null;
  writeRejects = false;
  execCommandCopies = true;
  alerts = [];
  vi.stubGlobal('navigator', {
    platform: 'Linux x86_64',
    clipboard: {
      writeText: (text: string) => {
        if (writeRejects) return Promise.reject(new Error('denied'));
        clipboardText = text;
        return Promise.resolve();
      },
      readText: () =>
        clipboardText === null
          ? Promise.reject(new Error('denied'))
          : Promise.resolve(clipboardText),
    },
  });
  // The legacy copy fallback: a detached textarea plus execCommand('copy').
  vi.stubGlobal('document', {
    createElement: () => ({
      value: '',
      style: {},
      setAttribute: () => undefined,
      select: () => undefined,
      remove: () => undefined,
    }),
    body: { appendChild: () => undefined },
    execCommand: () => execCommandCopies,
  });
  vi.stubGlobal('window', {
    alert: (message: string) => alerts.push(message),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isViewEditorCommand', () => {
  it('claims the general commands and leaves renumbering alone', () => {
    for (const name of [
      'undo',
      'redo',
      'cut',
      'copy',
      'paste',
      'find',
      'closeFind',
    ] as const) {
      expect(isViewEditorCommand(name)).toBe(true);
    }
    expect(isViewEditorCommand('renumber')).toBe(false);
    expect(isViewEditorCommand('renumberFile')).toBe(false);
  });
});

describe('runViewEditorCommand', () => {
  it('undoes and redoes the buffer, and returns focus to it', async () => {
    const fake = fakeView('10 REM one', ['\n20 REM two']);
    expect(await runViewEditorCommand(asView(fake), 'undo')).toBe(true);
    expect(fake.text()).toBe('10 REM one');
    expect(fake.focused).toBe(1);

    await runViewEditorCommand(asView(fake), 'redo');
    expect(fake.text()).toBe('10 REM one\n20 REM two');
  });

  it('copies the whole line when nothing is selected, without changing it', async () => {
    const fake = fakeView('10 REM one\n20 REM two');
    await runViewEditorCommand(asView(fake), 'copy');
    expect(clipboardText).toBe('10 REM one\n');
    expect(fake.text()).toBe('10 REM one\n20 REM two');
  });

  it('cuts the line it copied', async () => {
    const fake = fakeView('10 REM one\n20 REM two');
    await runViewEditorCommand(asView(fake), 'cut');
    expect(clipboardText).toBe('10 REM one\n');
    expect(fake.text()).toBe('20 REM two');
  });

  it('falls back to execCommand when the async write is refused', async () => {
    writeRejects = true;
    const fake = fakeView('10 REM one\n');
    await runViewEditorCommand(asView(fake), 'cut');
    // The fallback reported success, so the cut went through.
    expect(fake.text()).toBe('');
  });

  it('refuses to cut when the text never reached the clipboard', async () => {
    writeRejects = true;
    execCommandCopies = false;
    const fake = fakeView('10 REM one\n20 REM two');
    await runViewEditorCommand(asView(fake), 'cut');
    // Nothing was destroyed: a cut that cannot copy is not a cut.
    expect(fake.text()).toBe('10 REM one\n20 REM two');
    expect(fake.transactions).toBe(0);
  });

  it('pastes the clipboard over the selection', async () => {
    clipboardText = 'PASTED';
    const fake = fakeView('10 REM one');
    await runViewEditorCommand(asView(fake), 'paste');
    expect(fake.text()).toContain('PASTED');
  });

  it('explains itself rather than doing nothing when the read is refused', async () => {
    clipboardText = null; // readText rejects
    const fake = fakeView('10 REM one');
    await runViewEditorCommand(asView(fake), 'paste');
    expect(fake.text()).toBe('10 REM one');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatch(/Ctrl\+V/);
  });

  it('opens the find panel and leaves focus to it', async () => {
    const fake = fakeView('10 REM one');
    expect(await runViewEditorCommand(asView(fake), 'find')).toBe(true);
    // The panel's extensions were appended; the editor did not take focus back.
    expect(fake.transactions).toBe(1);
    expect(fake.focused).toBe(0);
  });

  it('closing an unopened find panel is a no-op it still claims', async () => {
    const fake = fakeView('10 REM one');
    expect(await runViewEditorCommand(asView(fake), 'closeFind')).toBe(true);
    expect(fake.transactions).toBe(0);
  });

  it('leaves renumbering to its owner', async () => {
    const fake = fakeView('10 REM one');
    expect(await runViewEditorCommand(asView(fake), 'renumber')).toBe(false);
    expect(await runViewEditorCommand(asView(fake), 'renumberFile')).toBe(
      false,
    );
    expect(fake.transactions).toBe(0);
  });
});
