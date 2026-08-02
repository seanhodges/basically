/**
 * Pins each dialect reference table to the dialect's own keyword table, so the
 * docs cannot drift from the code:
 *
 *  1. Completeness: every word in the keyword table has a reference row of the
 *     same name - a keyword added to a dialect fails here until its docs row
 *     exists, keeping "every command, function and operator" true.
 *  2. No inventions: every reference row names a word the keyword table
 *     actually contains, so the docs never document a keyword the tokenizer
 *     doesn't accept.
 *
 * Both run **per machine**, over all thirteen registered dialects, not per docs
 * page. Four pages cover more than one machine, and their rows are the union of
 * what those machines have - so checking the page against the union let a row
 * belong to every machine on the page whether or not that machine had it, which
 * is exactly what made the porting comparison report BASIC 1.1 commands to a
 * CPC 464. `ReferenceEntry.onlyOn` narrows a row to the machines that have it,
 * and these assertions are what make that hand-authored scoping trustworthy: a
 * mis-scoped row fails one machine's check, and a newly registered dialect fails
 * until its rows exist.
 *
 * These assertions now guard a second seam as well. The porting guide narrows
 * itself to the open program by matching *keyword names* sent across the
 * IDE↔docs iframe boundary (`PROGRAM_VOCABULARY_FIELDS` in
 * src/components/DocsDrawer.tsx): the app names what the program uses in the
 * dialect's own spelling, and the docs side looks those names up in these
 * tables. Nothing typechecks across that boundary, so what keeps a name meaning
 * the same thing on both sides of it is exactly the per-machine agreement
 * checked here - drift would silently narrow a comparison to nothing.
 *
 * Comparison is by unique name (keyword tables may list alias spellings that
 * collapse into one row), mirroring scripts/gen-reference-scaffold.mts. Like
 * escapes/escape-crosscheck.test.ts, this file may reach the dialect registry
 * freely: vitest runs it in node, and neither the VitePress bundle nor the IDE's
 * own bundle includes *.test.ts.
 */
import { describe, expect, it } from 'vitest';
import type { EditorKeyword } from '../dialects/types';
import type { ReferenceTableData } from './types';

import { zx81Reference } from './zx81';
import { zx80Reference } from './zx80';
import { zxspectrumReference } from './zxspectrum';
import { bbcReference } from './bbc';
import { commodoreReference } from './commodore';
import { atomReference } from './atom';
import { trs80Reference } from './trs80';
import { cpcReference } from './cpc';

import { dialects } from '../dialects/registry';
import { zx80IntegralFunctions } from '../dialects/zx80/keywords';

const PAGES: Record<string, ReferenceTableData> = {
  atom: atomReference,
  bbc: bbcReference,
  commodore: commodoreReference,
  cpc: cpcReference,
  trs80: trs80Reference,
  zx80: zx80Reference,
  zx81: zx81Reference,
  zxspectrum: zxspectrumReference,
};

/**
 * Words the editor knows for a machine but the tokenizer does not emit. The
 * ZX80's integral functions are computed by the editor rather than tokenized,
 * yet they are part of the language and belong in its table.
 */
const EXTRA_KEYWORDS: Record<string, EditorKeyword[]> = {
  zx80: zx80IntegralFunctions,
};

/** The rows a page carries for one machine: unscoped, plus those naming it. */
function rowsFor(page: ReferenceTableData, dialectId: string) {
  return page.entries.filter((e) => !e.onlyOn || e.onlyOn.includes(dialectId));
}

const CASES = dialects.map((dialect) => {
  const page = PAGES[dialect.docsReference ?? dialect.id];
  if (!page) {
    throw new Error(
      `No reference page registered for dialect: ${dialect.id} ` +
        `(looked for "${dialect.docsReference ?? dialect.id}")`,
    );
  }
  return [
    dialect.id,
    rowsFor(page, dialect.id),
    [...dialect.keywords, ...(EXTRA_KEYWORDS[dialect.id] ?? [])],
  ] as const;
});

describe.each(CASES)('keyword crosscheck: %s', (_id, rows, keywords) => {
  const rowNames = new Set(rows.map((e) => e.name));
  const keywordWords = new Set(keywords.map((k) => k.word));

  it('every keyword has a reference row', () => {
    const missing = [...keywordWords].filter((w) => !rowNames.has(w));
    expect(missing).toEqual([]);
  });

  it('every reference row is a real keyword', () => {
    const invented = [...rowNames].filter((n) => !keywordWords.has(n));
    expect(invented).toEqual([]);
  });
});

describe('page coverage', () => {
  it('every reference page belongs to at least one registered machine', () => {
    const used = new Set(dialects.map((d) => d.docsReference ?? d.id));
    expect([...Object.keys(PAGES)].filter((p) => !used.has(p))).toEqual([]);
  });

  // A scoped row naming a machine that is not on its own page would be silently
  // dropped from every machine's set, hiding a keyword from the docs entirely.
  it('every onlyOn names a machine the page covers', () => {
    for (const [page, data] of Object.entries(PAGES)) {
      const onPage = new Set(
        dialects
          .filter((d) => (d.docsReference ?? d.id) === page)
          .map((d) => d.id),
      );
      for (const entry of data.entries) {
        for (const id of entry.onlyOn ?? []) {
          expect(onPage, `${page}: ${entry.name} scoped to ${id}`).toContain(
            id,
          );
        }
      }
    }
  });
});
