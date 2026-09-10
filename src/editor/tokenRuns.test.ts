// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Every token in a range, checked against the real tokenizers.
 *
 * The tag strings asserted here are the contract with `./basicLanguage`: they
 * are what its `token()` returns, and a rename there must fail here rather than
 * quietly reaching the callers as an unknown kind.
 */
import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { getDialect } from '../dialects/registry';
import { tokensIn } from './tokenRuns';

function stateFor(dialectId: string, doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [getDialect(dialectId).languageSupport()],
  });
}

/** Every token of the whole document, as `kind:text` pairs. */
function runs(dialectId: string, doc: string): string[] {
  const state = stateFor(dialectId, doc);
  return tokensIn(state, 0, state.doc.length).map((t) => `${t.kind}:${t.text}`);
}

describe('tokensIn', () => {
  it('reports a line as the runs the tokenizer made of it', () => {
    expect(runs('zx81', '10 PRINT "HI"')).toEqual([
      'labelName:10',
      'keyword:PRINT',
      'string:"HI"',
    ]);
  });

  it('distinguishes a line number from a numeric literal', () => {
    const found = runs('zx81', '10 LET A=20');
    expect(found).toContain('labelName:10');
    expect(found).toContain('number:20');
  });

  it('carries a REM comment as one run', () => {
    expect(runs('zx81', '10 REM hello there')).toEqual([
      'labelName:10',
      'keyword:REM',
      'comment: hello there',
    ]);
  });

  it('reports every line of a program in document order', () => {
    const found = runs('zx81', '10 PRINT "A"\n20 GOTO 10\n');
    expect(found).toEqual([
      'labelName:10',
      'keyword:PRINT',
      'string:"A"',
      'labelName:20',
      'keyword:GOTO',
      'number:10',
    ]);
  });

  it('returns a token overlapping the range whole rather than clipped', () => {
    const text = '10 PRINT "HI"';
    const state = stateFor('zx81', text);
    // Start inside PRINT and stop inside the string: both must come back whole,
    // because a caller wants to know what the token is, not how much of it the
    // range covered.
    const from = text.indexOf('RINT');
    const to = text.indexOf('HI');
    expect(tokensIn(state, from, to).map((t) => t.text)).toEqual([
      'PRINT',
      '"HI"',
    ]);
  });

  it('answers about the range asked for and not the whole program', () => {
    const text = '10 PRINT "A"\n20 PRINT "B"\n30 PRINT "C"\n';
    const state = stateFor('zx81', text);
    const second = state.doc.line(2);
    expect(tokensIn(state, second.from, second.to).map((t) => t.text)).toEqual([
      '20',
      'PRINT',
      '"B"',
    ]);
  });

  it('is empty for an empty range', () => {
    const state = stateFor('zx81', '10 PRINT "HI"');
    expect(tokensIn(state, 4, 4)).toEqual([]);
    expect(tokensIn(state, 6, 2)).toEqual([]);
  });

  it('splits a crunched run the way that machine reads it', () => {
    // A machine whose ROM matches the longest keyword at every position reads
    // `POKEA` as a keyword and a variable, not as one name.
    expect(runs('commodore64', '10 POKEA=1')).toEqual([
      'labelName:10',
      'keyword:POKE',
      'variableName:A',
      'operator:=',
      'number:1',
    ]);
  });

  it('carries a #MACHINE declaration as one directive', () => {
    // The line contributes nothing to the program, so it is neither a keyword
    // nor the two variable names its text would otherwise make of it.
    expect(runs('zx81', '#MACHINE zx81\n10 PRINT "HI"')).toEqual([
      'meta:#MACHINE zx81',
      'labelName:10',
      'keyword:PRINT',
      'string:"HI"',
    ]);
  });

  it('carries a #BIN directive as one opaque run', () => {
    // Its payload is base64 and can spell a keyword by coincidence, so the line
    // is one directive rather than the runs its text would otherwise make.
    expect(runs('zxspectrum', '#BIN UFJJTlRBQQ==')).toEqual([
      'meta:#BIN UFJJTlRBQQ==',
    ]);
  });

  it('reaches past the region a lazy parse would have covered', () => {
    // The lazy tree stops a few kilobytes in whatever the program's length, so
    // a line past that mark is the case this has to get right.
    //
    // The program is sized just past the mark rather than as long as possible.
    // Forcing the parse is bounded by a budget, so a test needing a long parse
    // to finish inside it measures the machine it runs on rather than this
    // code - which is how an earlier 4000-line version of this passed here and
    // failed on a loaded CI runner. At this length the parse has two orders of
    // magnitude of headroom against the budget.
    const lines = Array.from(
      { length: 400 },
      (_, i) => `${(i + 1) * 10} PRINT "LINE"`,
    );
    const state = stateFor('zx81', lines.join('\n'));
    const last = state.doc.line(state.doc.lines);
    expect(
      syntaxTree(state).length,
      'the lazy tree already reaches the last line, so this proves nothing',
    ).toBeLessThan(last.from);
    expect(tokensIn(state, last.from, last.to).map((t) => t.kind)).toEqual([
      'labelName',
      'keyword',
      'string',
    ]);
  });
});
