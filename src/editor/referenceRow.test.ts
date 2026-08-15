// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * What the reference row will and will not offer to look up.
 *
 * Recognition itself is `tokenAt.test.ts`' job. What is checked here is the step
 * layered over it - cutting a run of adjacent operator characters back to a
 * spelling the machine actually declares - and the promise that everything the
 * row does accept has somewhere to go. `src/reference/keyword-crosscheck.test.ts`
 * guarantees the row exists on the page; this closes the loop from the
 * tokenizer to that row.
 */
import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { dialects, getDialect } from '../dialects/registry';
import { operatorSpellings, OPERATOR_PUNCTUATION } from '../dialects/operators';
import type { Dialect } from '../dialects/types';
import { referenceTopic } from '../app/docsTopic';
import { BASIC_REFERENCE_KINDS, referenceTokenAt } from './referenceRow';

function stateFor(dialect: Dialect, doc: string): EditorState {
  return EditorState.create({ doc, extensions: [dialect.languageSupport()] });
}

/** The token the row would take at the first offset of `needle`, or null. */
function lookup(dialectId: string, doc: string, needle: string): string | null {
  const dialect = getDialect(dialectId);
  const state = stateFor(dialect, doc);
  const pos = state.doc.toString().indexOf(needle);
  expect(pos, `${needle} not in ${JSON.stringify(doc)}`).toBeGreaterThan(-1);
  return (
    referenceTokenAt(
      state,
      pos,
      BASIC_REFERENCE_KINDS,
      operatorSpellings(dialect),
    )?.text ?? null
  );
}

describe('punctuation has nothing to look up', () => {
  // Each of these is tagged an operator by the highlighter on every dialect,
  // and none of them earns a row on a reference page.
  it.each([';', ',', '(', ')', ':'])('skips %s', (char) => {
    expect(lookup('zx81', `10 PRINT A${char}B`, char)).toBeNull();
  });

  it('skips the decimal point', () => {
    // Tagged an operator (a number needs a leading digit) and absent from the
    // crosscheck's own exception set, so that set could not stand in for this.
    expect(OPERATOR_PUNCTUATION.has('.')).toBe(false);
    expect(lookup('zx81', '10 LET A=.5', '.')).toBeNull();
  });
});

describe('a run of adjacent operator characters', () => {
  it('cuts back to the declared spelling the click is on', () => {
    // `=.` arrives as one node; the `=` half is a real operator and the `.` half
    // is not, so which one was clicked decides the answer.
    expect(lookup('zx81', '10 LET A=.5', '=')).toBe('=');
    expect(lookup('zx81', '10 LET A=.5', '.')).toBeNull();
  });

  it('keeps a declared multi-character spelling whole', () => {
    // Longest declared spelling wins, so `<=` does not come back as `<`.
    expect(lookup('bbcmicro', '10 IF A<=B THEN END', '<=')).toBe('<=');
  });

  it('separates two real operators that abut', () => {
    expect(lookup('zx81', '10 LET A=-1', '=')).toBe('=');
    expect(lookup('zx81', '10 LET A=-1', '-')).toBe('-');
  });
});

describe('a keyword typed short', () => {
  // The tokenizer accepts `P.` as PRINT, but the highlighter reads it as the
  // variable `P` followed by `.`, so there is no keyword token to pick and the
  // menu stays silent rather than guessing. Pinned because it is a real gap
  // against the reference page, whose search does match short spellings: a
  // reader of a dotted listing has to expand it, or search the page directly.
  it.each([
    ['bbcmicro', '20 P."HI"', 'P.'],
    ['bbcmicro', '30 G.20', 'G.'],
    ['commodore64', '20 ?"HI"', '?'],
  ])('%s offers nothing on %s', (dialectId, doc, needle) => {
    expect(lookup(dialectId, doc, needle)).toBeNull();
  });
});

describe('the machine’s own vocabulary answers', () => {
  it('offers a word operator', () => {
    expect(lookup('zx81', '10 IF A AND B THEN STOP', 'AND')).toBe('AND');
  });

  it('offers a keyword and a function', () => {
    expect(lookup('zx81', '10 PRINT SIN 1', 'PRINT')).toBe('PRINT');
    expect(lookup('zx81', '10 PRINT SIN 1', 'SIN')).toBe('SIN');
  });
});

describe('every accepted operator has somewhere to go', () => {
  for (const dialect of dialects) {
    const spellings = [...operatorSpellings(dialect)].filter(
      (s) => !OPERATOR_PUNCTUATION.has(s),
    );

    it(`${dialect.id} resolves a topic for each of its ${spellings.length}`, () => {
      for (const spelling of spellings) {
        // On its own after the line number, matching dialectOperators.test.ts -
        // a suffix rule cannot swallow it and a crunching dialect has no
        // identifier run to glue it to.
        const state = stateFor(dialect, `10 ${spelling}`);
        const token = referenceTokenAt(
          state,
          3,
          BASIC_REFERENCE_KINDS,
          operatorSpellings(dialect),
        );
        expect(
          token,
          `${dialect.id}: ${spelling} is not offered for lookup`,
        ).not.toBeNull();
        expect(
          referenceTopic(dialect, token!.text),
          `${dialect.id}: ${token!.text} has no reference topic`,
        ).not.toBeNull();
      }
    });
  }
});
