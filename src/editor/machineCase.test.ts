// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Typing the case the machine has.
 *
 * A transaction filter sees *every* transaction, so a filter that is wrong is
 * wrong on every keystroke: these are not optional. The four routes that write
 * to the document reach the filter as two user events, and both are driven
 * below -
 *
 *  - `input.type`: a physical keypress, the native-mobile `beforeinput` seam,
 *    and the on-screen keyboard (`applyEditorAction` in
 *    `src/components/CodeMirrorHost.tsx`, which dispatches exactly this);
 *  - `input.paste`: the browser's own paste, and the Edit-menu paste
 *    (`runViewEditorCommand` in `./editorCommands`), driven here through the
 *    real command rather than a hand-written event.
 *
 * What a browser adds on top - a real keypress, a real ⌘V - is
 * `e2e/code-editor`'s.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorState, type TransactionSpec } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { dialects, getDialect } from '../dialects/registry';
import { letterCaseFor } from '../dialects/letterCase';
import { machineCaseFilter } from './machineCase';
import { runViewEditorCommand } from './editorCommands';

/** A state carrying the filter for `dialectId`, with the setting on. */
function stateFor(dialectId: string, doc = '', strict = true): EditorState {
  return EditorState.create({
    doc,
    extensions: [machineCaseFilter(getDialect(dialectId), strict)],
  });
}

/** Apply one write to `state` and report the document it leaves. */
function write(
  state: EditorState,
  spec: { from?: number; insert: string; userEvent: string },
): string {
  const from = spec.from ?? state.doc.length;
  return state
    .update({
      changes: { from, insert: spec.insert },
      userEvent: spec.userEvent,
    })
    .state.doc.toString();
}

const typed = (state: EditorState, insert: string, from?: number) =>
  write(state, {
    ...(from === undefined ? {} : { from }),
    insert,
    userEvent: 'input.type',
  });

describe('forcing upper case on a machine with no lower case', () => {
  it('upper-cases what the reader types', () => {
    expect(typed(stateFor('zx81', '10 PRINT "'), 'hello')).toBe(
      '10 PRINT "HELLO',
    );
  });

  it('upper-cases one character at a time, as a keyboard delivers them', () => {
    // The on-screen keyboard and a physical key both arrive as single-character
    // `input.type` writes, so the rule has to hold with no run to look at.
    let state = stateFor('zx81', '10 ');
    for (const ch of 'print') {
      state = state.update({
        changes: { from: state.doc.length, insert: ch },
        userEvent: 'input.type',
      }).state;
    }
    expect(state.doc.toString()).toBe('10 PRINT');
  });

  it('upper-cases a pasted listing, every line of it', () => {
    const pasted = write(stateFor('zx81'), {
      insert: '10 print "hi"\n20 goto 10',
      userEvent: 'input.paste',
    });
    expect(pasted).toBe('10 PRINT "HI"\n20 GOTO 10');
  });

  it('upper-cases the Edit menu paste, through the command itself', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { readText: async () => 'print "hi"' },
    });
    let state = stateFor('zx81', '10 ').update({
      selection: { anchor: 3 },
    }).state;
    const view = {
      get state() {
        return state;
      },
      // The command dispatches the change and its user event as two specs, so
      // the stand-in has to combine them exactly as `EditorView.dispatch` does
      // - without the event the filter would rightly leave the paste alone.
      dispatch: (...specs: TransactionSpec[]) => {
        state = state.update(...specs).state;
      },
      focus: () => {},
    } as unknown as EditorView;
    await runViewEditorCommand(view, 'paste');
    expect(state.doc.toString()).toBe('10 PRINT "HI"');
  });

  it('leaves what the reader did not enter as letters', () => {
    // A raw byte is notation: its `x` is part of the spelling, and an
    // upper-cased one is not a byte on any machine here.
    expect(typed(stateFor('atom', '10 PRINT "'), '{0x41}')).toBe(
      '10 PRINT "{0x41}',
    );
    // Half-typed, one character at a time, is the case that actually bites.
    let state = stateFor('atom', '10 PRINT "');
    for (const ch of '{0x41}') {
      state = state.update({
        changes: { from: state.doc.length, insert: ch },
        userEvent: 'input.type',
      }).state;
    }
    expect(state.doc.toString()).toBe('10 PRINT "{0x41}');
  });

  it('leaves the inside of an escape alone when typed into', () => {
    // The prefix is what tells the walk this letter is inside notation, so the
    // insert has to be read as a continuation of its line rather than alone.
    const doc = '10 PRINT "{0x1}"';
    expect(typed(stateFor('trs80', doc), 'a', doc.indexOf('1}') + 1)).toBe(
      '10 PRINT "{0x1a}"',
    );
  });

  it.each(
    dialects.filter(
      (d) =>
        letterCaseFor(d.id)!.lowerCase === 'none' &&
        d.keyboardLayout?.graphicsPalette,
    ),
  )('inserts $id graphics palette cells as they are', (dialect) => {
    // A palette cell is a character the reader picked, not a letter they typed
    // - and on the machines with no keycap graphics the cell inserts an escape,
    // whose spelling carries a lower case that means something.
    const state = stateFor(dialect.id, '10 PRINT "');
    for (const section of dialect.keyboardLayout!.graphicsPalette!.sections) {
      for (const entry of section.entries) {
        expect(typed(state, entry.char), `${dialect.id} ${entry.code}`).toBe(
          `10 PRINT "${entry.char}`,
        );
      }
    }
  });

  it('leaves alone what no user typed - a document swap, an AI merge', () => {
    const state = stateFor('zx81');
    expect(
      state
        .update({ changes: { from: 0, insert: '10 print "hi"' } })
        .state.doc.toString(),
    ).toBe('10 print "hi"');
  });
});

describe('what the setting does not touch', () => {
  it('leaves a machine that has lower case exactly as typed', () => {
    expect(typed(stateFor('zxspectrum', '10 PRINT "'), 'hello')).toBe(
      '10 PRINT "hello',
    );
    expect(typed(stateFor('commodore64', '10 PRINT "'), 'hello')).toBe(
      '10 PRINT "hello',
    );
  });

  it('leaves an uppercase-only machine alone while the setting is off', () => {
    expect(typed(stateFor('zx81', '10 PRINT "', false), 'hello')).toBe(
      '10 PRINT "hello',
    );
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
