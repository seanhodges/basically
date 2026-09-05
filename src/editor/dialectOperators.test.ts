/**
 * Every operator every registered machine has is coloured as an operator.
 *
 * The editor used to carry its own idea of what an operator looks like - one
 * shared set of characters plus one hardcoded list of two-character spellings,
 * applied to all fourteen machines. It was wrong in both directions: the `↑`
 * that five of them raise to a power with was in neither list and drew as a
 * block graphic, the CPC's `\` was tokenized but never styled, and a ZX81 with
 * no `?` character coloured one navy anyway.
 *
 * Now the dialect says, and this walks the registry to check that what it says
 * arrives. A machine whose operator set grows or shrinks fails here until its
 * highlighting follows - which is the whole reason the set is declared in one
 * place rather than three.
 */
import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import { highlightTree, tagHighlighter, tags } from '@lezer/highlight';
import { dialects } from '../dialects/registry';
import { operatorSpellings } from '../dialects/operators';
import type { Dialect } from '../dialects/types';

const probe = tagHighlighter([{ tag: tags.operator, class: 'op' }]);

/** The spans of `doc` this dialect's highlighter tags as an operator. */
function operatorSpans(dialect: Dialect, doc: string): string[] {
  const state = EditorState.create({
    doc,
    extensions: [dialect.languageSupport()],
  });
  const tree = ensureSyntaxTree(state, doc.length, 1e9);
  if (!tree) throw new Error(`${dialect.id}: no syntax tree`);
  const spans: string[] = [];
  highlightTree(tree, probe, (from, to, cls) => {
    if (cls === 'op') spans.push(doc.slice(from, to));
  });
  return spans;
}

describe('every dialect colours its own operators', () => {
  for (const dialect of dialects) {
    const spellings = [...operatorSpellings(dialect)];

    it(`${dialect.id} tags all ${spellings.length} of them`, () => {
      for (const spelling of spellings) {
        // On its own after the line number, so a suffix rule cannot swallow it
        // (`$` terminates a BBC variable name) and a crunching dialect has no
        // identifier run to glue it to.
        const doc = `10 ${spelling}`;
        expect(
          operatorSpans(dialect, doc).join(''),
          `${dialect.id} does not style ${spelling} as an operator`,
        ).toContain(spelling);
      }
    });
  }

  it('covers a set worth walking', () => {
    // A guard against the union quietly becoming empty - which would make every
    // assertion above vacuously true.
    for (const dialect of dialects) {
      expect(
        operatorSpellings(dialect).size,
        `${dialect.id} declares no operators at all`,
      ).toBeGreaterThan(8);
    }
  });
});
