// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * A word spelled in lower case is a keyword only on the machines that read it
 * as one - and where it is not, it is a name in *every* part of the editor.
 *
 * The failure this closes: a BBC program was coloured as calling PRINT and
 * flagged in the same breath for not calling it, because the highlighter folded
 * case and the tokenizer beside it did not. Which machines fold is declared
 * once (`foldsKeywordCase` in `src/dialects/letterCase.ts`); this pins that the
 * editor's four answers - the colour, the variable scan, the abbreviation
 * reader and the completion menu - all come from it.
 */
import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import { ensureSyntaxTree } from '@codemirror/language';
import { highlightTree, tagHighlighter, tags } from '@lezer/highlight';
import { getDialect } from '../dialects/registry';
import type { Dialect } from '../dialects/types';
import { outlineCapabilities } from './programOutline';
import { eachOccurrence, makeVariableSource } from './variables';
import { variableRulesFor } from './variableLexis';
import { bbcCompletionSource } from '../dialects/bbcmicro/language';

const probe = tagHighlighter([
  { tag: tags.keyword, class: 'kw' },
  { tag: tags.comment, class: 'kw' },
  { tag: tags.function(tags.variableName), class: 'fn' },
  { tag: tags.operator, class: 'op' },
  { tag: tags.variableName, class: 'var' },
]);

/** The [text, role] pairs the dialect's own highlighter gives `doc`. */
function spans(dialect: Dialect, doc: string): [string, string][] {
  const state = EditorState.create({
    doc,
    extensions: [dialect.languageSupport()],
  });
  const tree = ensureSyntaxTree(state, doc.length, 1e9);
  if (!tree) throw new Error(`${dialect.id}: no syntax tree`);
  const out: [string, string][] = [];
  highlightTree(tree, probe, (from, to, cls) =>
    out.push([doc.slice(from, to), cls]),
  );
  return out;
}

/** The variable names the document scanner finds in `doc`. */
function variableNames(dialectId: string, doc: string): string[] {
  const dialect = getDialect(dialectId);
  const names: string[] = [];
  eachOccurrence(doc, variableRulesFor(dialectId, dialect.keywords), (occ) =>
    names.push(occ.name),
  );
  return names;
}

describe('a keyword spelled in lower case', () => {
  it('is a name on a machine whose ROM matches by character', () => {
    // BBC BASIC compares its keyword table byte for byte, so this word is not
    // PRINT: it is a variable called `print`, and the editor says so in the
    // colour as well as in the diagnostic.
    expect(spans(getDialect('bbcmicro'), '10 print=1')).toContainEqual([
      'print',
      'var',
    ]);
    expect(variableNames('bbcmicro', '10 print=1')).toEqual(['print']);
  });

  it('is the keyword on a machine whose encoding folds', () => {
    // Nothing on a Sinclair or a Commodore ever presents lower case to the
    // ROM - one character serves both cases - so `print` there is PRINT.
    expect(spans(getDialect('zx81'), '10 print "HI"')).toContainEqual([
      'print',
      'kw',
    ]);
    expect(variableNames('commodore64', '10 print "HI"')).toEqual([]);
  });

  it('is the keyword on a machine whose dialect is declared lenient', () => {
    // The Atom and the PMD 85 read it and report it; the reading is what makes
    // a lower-case listing openable, and the report is what stops that being a
    // claim that the machine will run it.
    expect(spans(getDialect('pmd85'), '10 print "HI"')).toContainEqual([
      'print',
      'kw',
    ]);
  });

  it('carries the same answer into the outline and the rename', () => {
    // One scan behind all three, so a word cannot be a keyword to the colour
    // and a name to the checks.
    const doc = '10 print=1\n20 print=print+1';
    expect(variableNames('bbcmicro', doc)).toEqual(['print', 'print', 'print']);
  });
});

describe('a short spelling in a case the machine would not accept', () => {
  it('is a name and a full stop on the Acorn BBCs', () => {
    const doc = '10 p."HI"';
    expect(spans(getDialect('bbcmicro'), doc)).not.toContainEqual(['p.', 'kw']);
    expect(spans(getDialect('bbcmicro'), doc)).toContainEqual(['p', 'var']);
  });

  it('still reads the Commodore shifted-letter form, which needs lower case', () => {
    // The two rules do not compete: a shifted spelling *requires* a lower-case
    // prefix, and only machines that fold have one.
    expect(spans(getDialect('commodore64'), '10 pO53280,1')).toContainEqual([
      'pO',
      'kw',
    ]);
  });

  it('still reads an upper-case dotted spelling on the BBC', () => {
    expect(spans(getDialect('bbcmicro'), '10 P."HI"')).toContainEqual([
      'P.',
      'kw',
    ]);
  });
});

describe('completion on a machine that reads lower case as a name', () => {
  it('offers both the keyword and the variable for the same word', () => {
    // The reader may mean either, and the editor cannot know which - so it
    // offers PRINT the command and `print` the variable they already have.
    const doc = '10 print=1\n20 pri';
    const state = EditorState.create({ doc });
    const at = new CompletionContext(state, doc.length, true);

    const keywords = bbcCompletionSource(at);
    expect(keywords).not.toBeNull();
    expect(keywords!.options.map((o) => o.label)).toContain('PRINT');

    const bbc = getDialect('bbcmicro');
    const variables = makeVariableSource(
      variableRulesFor('bbcmicro', bbc.keywords),
      outlineCapabilities(bbc.keywords),
    )(at);
    expect(variables).not.toBeNull();
    expect(variables!.options.map((o) => o.label)).toContain('print');
  });
});
