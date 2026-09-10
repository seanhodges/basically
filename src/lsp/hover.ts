// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * What a keyword, function or operator under the cursor explains itself as.
 *
 * Recognition and resolution are the editor's own: `referenceTokenAt` picks
 * the token (cutting an operator run back to a spelling the machine actually
 * declares) and `lookupWord` resolves a short spelling to the keyword it
 * stands for - the same two calls `src/editor/referenceRow.ts` makes for the
 * IDE's own "look up in the reference" menu row. The reference page loads on
 * demand through `src/ai/machineReference.ts`'s existing per-page `import()`
 * map, so this module needs no map of its own and the reference tree stays
 * out of the initial browser download.
 */
import type { EditorState } from '@codemirror/state';
import { MarkupKind, type Hover, type Position } from 'vscode-languageserver';
import {
  BASIC_REFERENCE_KINDS,
  lookupWord,
  referenceTokenAt,
} from '../editor/referenceRow';
import { operatorSpellings } from '../dialects/operators';
import { keywordSpellingsFor } from '../dialects/keywordSpellings';
import {
  PUBLIC_DOCS_BASE,
  referencePageOf,
  referenceTopicOf,
} from '../dialects/referencePage';
import { loadReferencePage } from '../ai/machineReference';
import type { ReferenceEntry } from '../reference/types';
import type { EditorKeyword } from '../dialects/types';
import { offsetToPosition, positionToOffset } from './documents';
import type { OpenDocument } from './documents';

function composeFromEntry(
  word: string,
  entry: ReferenceEntry,
  topic: string | null,
): string {
  const lines = [
    `**${word}**`,
    '',
    `\`${entry.syntax}\``,
    '',
    entry.description,
  ];
  if (entry.tag) lines.push('', `_${entry.tag}_`);
  // The route on to the full entry, for a reader who wants more than this.
  // Absolute, because the editor rendering it is outside the browser and has
  // no `/docs/` mount of its own to resolve against.
  if (topic)
    lines.push(
      '',
      `[Open ${word} in the reference](${PUBLIC_DOCS_BASE}${topic})`,
    );
  return lines.join('\n');
}

function composeFromKeyword(
  word: string,
  keyword: EditorKeyword | undefined,
): string {
  const lines = [`**${word}**`];
  if (keyword?.signature) lines.push('', `\`${keyword.signature}\``);
  if (keyword?.doc) lines.push('', keyword.doc);
  return lines.join('\n');
}

/**
 * The markdown for `word`: the reference page's own row where the page has
 * one, else the dialect's own `signature`/`doc` - so every machine explains
 * something, even a keyword the reference has no row for.
 *
 * Only the reference-backed form carries the route on to the full entry.
 * Offering it from the fallback would send the reader to a page that searches
 * for a keyword it has no row for and shows nothing, which costs them the trip
 * to find out.
 */
export function composeHover(
  word: string,
  entry: ReferenceEntry | undefined,
  keyword: EditorKeyword | undefined,
  topic: string | null = null,
): string {
  return entry
    ? composeFromEntry(word, entry, topic)
    : composeFromKeyword(word, keyword);
}

/**
 * Hover text for the token at `position`, or null where there is nothing to
 * look up there - no binding, or no reference-eligible token under the
 * cursor.
 */
export async function hoverAt(
  doc: OpenDocument,
  state: EditorState,
  position: Position,
): Promise<Hover | null> {
  if (doc.binding.kind !== 'bound') return null;
  const dialect = doc.binding.dialect;
  const pos = positionToOffset(doc.text, position);
  const token = referenceTokenAt(
    state,
    pos,
    BASIC_REFERENCE_KINDS,
    operatorSpellings(dialect),
  );
  if (!token) return null;

  const word = lookupWord(token.text, keywordSpellingsFor(dialect.id));
  const page = await loadReferencePage(referencePageOf(dialect));
  const { tableForMachine } = await import('../reference/compare');
  const entry = page
    ? tableForMachine(page, dialect.id).entries.find((e) => e.name === word)
    : undefined;
  const keyword = dialect.keywords.find((k) => k.word === word);

  return {
    contents: {
      kind: MarkupKind.Markdown,
      // `word`, not `token.text`: a short spelling reaches the entry for the
      // keyword it stands for rather than for the spelling.
      value: composeHover(
        word,
        entry,
        keyword,
        referenceTopicOf(dialect, word),
      ),
    },
    range: {
      start: offsetToPosition(doc.text, token.from),
      end: offsetToPosition(doc.text, token.to),
    },
  };
}
