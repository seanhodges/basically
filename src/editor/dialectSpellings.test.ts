// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Every short spelling every registered machine accepts is read as the keyword
 * it stands for - coloured as that keyword, and not counted as a variable.
 *
 * A listing typed on the machine spells keywords the way the machine lets it,
 * so a pasted archive program is full of them. The tokenizer has always read
 * them; the highlighter and the variable scanner did not, so a BBC `P."HI"`
 * drew as a name and a full stop and reported a variable `P` the program has
 * no such thing as.
 *
 * The registry decides what is checked, as it does for operators
 * (`dialectOperators.test.ts`): a machine whose spellings grow, or one added
 * without them wired into its `languageSupport`, fails here. Which spelling
 * means which keyword is `src/dialects/keywordSpellings.test.ts`' business, and
 * is pinned there against each machine's own tokenizer.
 */
import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import { highlightTree, tagHighlighter, tags } from '@lezer/highlight';
import { dialects, getDialect } from '../dialects/registry';
import { shortSpellingsFor } from '../dialects/keywordSpellings';
import type { Dialect } from '../dialects/types';
import { variableRulesFor } from './variableLexis';
import { eachOccurrence } from './variables';

/**
 * The roles a keyword can wear. Kept apart rather than lumped together, because
 * what is checked below is that a spelling wears the *same* role its keyword
 * does: `A.` is AND, which every Acorn colours as an operator, so colouring the
 * spelling as a command would be as wrong as colouring it as a name.
 */
const probe = tagHighlighter([
  { tag: tags.keyword, class: 'kw' },
  { tag: tags.comment, class: 'kw' },
  { tag: tags.function(tags.variableName), class: 'fn' },
  { tag: tags.operator, class: 'op' },
  { tag: tags.variableName, class: 'var' },
]);

/** The role `text` wears on its own after a line number, or undefined. */
function roleOf(dialect: Dialect, text: string): string | undefined {
  const doc = `10 ${text}`;
  return spans(dialect, doc).find(([t]) => t === text)?.[1];
}

/** The [text, role] pairs the dialect's highlighter gives `doc`. */
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

function variableNames(dialect: Dialect, doc: string): string[] {
  const names: string[] = [];
  eachOccurrence(doc, variableRulesFor(dialect.id, dialect.keywords), (occ) =>
    names.push(occ.name),
  );
  return names;
}

describe('short spellings are read as their keywords', () => {
  for (const dialect of dialects) {
    const spellings = [...shortSpellingsFor(dialect.id)].flatMap(
      ([keyword, forms]) => forms.map((form) => ({ keyword, form })),
    );
    if (spellings.length === 0) continue;

    it(`${dialect.id} colours all ${spellings.length} as their keyword`, () => {
      for (const { keyword, form } of spellings) {
        // A keyword this machine's highlight table does not carry still has to
        // read as a command rather than as a name: the Master resolves its own
        // BASIC IV spellings against the Micro's table.
        const expected = roleOf(dialect, keyword) ?? 'kw';
        expect(
          roleOf(dialect, form),
          `${dialect.id}: ${form} does not read as ${keyword}`,
        ).toBe(expected);
      }
    });

    it(`${dialect.id} counts none of them as a variable`, () => {
      for (const { keyword, form } of spellings) {
        expect(
          variableNames(dialect, `10 ${form}`),
          `${dialect.id}: ${form} (${keyword}) was read as a variable`,
        ).toEqual([]);
      }
    });
  }
});

describe('a listing written the short way', () => {
  it('reads a dotted Acorn line as commands, not names', () => {
    const doc = '20 P."HI"';
    // Used to be ['P', 'var'] then ['.', 'op'].
    expect(spans(getDialect('bbcmicro'), doc)).toContainEqual(['P.', 'kw']);
    expect(variableNames(getDialect('bbcmicro'), doc)).toEqual([]);
  });

  it('splits a shifted Commodore line into command and arguments', () => {
    // The whole run used to come back as one variable called `pO53280`.
    const doc = '20 pO53280,1';
    expect(spans(getDialect('commodore64'), doc)).toContainEqual(['pO', 'kw']);
    expect(variableNames(getDialect('commodore64'), doc)).toEqual([]);
  });

  it('reads a symbol standing for a whole command', () => {
    expect(spans(getDialect('commodore64'), '20 ?"HI"')).toContainEqual([
      '?',
      'kw',
    ]);
    expect(spans(getDialect('trs80'), '20 ?"HI"')).toContainEqual(['?', 'kw']);
  });

  it("carries a comment marker's line into the comment", () => {
    // `'` is REM on a CPC, so what follows it is comment text and not a name.
    const doc = "20 'note to self";
    expect(spans(getDialect('cpc464'), doc)).toContainEqual(["'", 'kw']);
    expect(variableNames(getDialect('cpc464'), doc)).toEqual([]);
  });

  it('leaves a prefix that spells a whole keyword alone', () => {
    // `gO` is GO, not GOTO - the tokenizer takes the full spelling, and a
    // spelling that is itself a keyword is never an abbreviation.
    const doc = '20 IF A AND B THEN STOP';
    expect(variableNames(getDialect('zx81'), doc)).toEqual(['A', 'B']);
  });

  it('does not claim the Atom’s ? , which is an operator there', () => {
    // The Acorns read `?` as byte indirection, so it must not become PRINT.
    const doc = '20 ?100=1';
    expect(spans(getDialect('atom'), doc)).not.toContainEqual(['?', 'kw']);
  });
});
