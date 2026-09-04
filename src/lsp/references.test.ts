// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { DocumentStore, offsetToPosition } from './documents';
import { documentHighlightsAt, referencesAt } from './references';

function refsAt(dialectId: string, text: string, offset: number) {
  const store = new DocumentStore();
  store.open('file:///a.bas', text, 1, dialectId);
  const doc = store.get('file:///a.bas')!;
  return referencesAt(doc, offsetToPosition(text, offset));
}

describe('referencesAt', () => {
  it('reports every place the machine would read the same variable', () => {
    const text = '10 LET A=1\n20 PRINT A\n30 LET B=A+1';
    const refs = refsAt('zx81', text, text.indexOf('A=1'));
    expect(refs).toHaveLength(3);
  });

  it('excludes a name appearing as a keyword, in a string and in a comment', () => {
    const text = '10 LET A=1\n20 PRINT "A"\n30 REM A is fine here\n40 PRINT A';
    const refs = refsAt('zx81', text, text.indexOf('A=1'));
    // Only the LET and the final PRINT A are real usages.
    expect(refs).toHaveLength(2);
  });

  it("honours the machine's truncation rule, reaching other names it stores as the same variable", () => {
    // Commodore BASIC keeps only the first two characters of a name.
    const text = '10 LET SCORE=1\n20 PRINT SCOTT';
    const refs = refsAt('commodore64', text, text.indexOf('SCORE'));
    expect(refs).toHaveLength(2);
  });

  it('gives nothing for a declined document', () => {
    expect(refsAt(undefined as never, '', 0)).toEqual([]);
  });
});

describe('documentHighlightsAt', () => {
  it('wraps the same ranges as document highlights', () => {
    const text = '10 LET A=1\n20 PRINT A';
    const store = new DocumentStore();
    store.open('file:///a.bas', text, 1, 'zx81');
    const doc = store.get('file:///a.bas')!;
    const pos = offsetToPosition(text, text.indexOf('A=1'));
    const highlights = documentHighlightsAt(doc, pos);
    const refs = referencesAt(doc, pos);
    expect(highlights.map((h) => h.range)).toEqual(refs);
  });
});
