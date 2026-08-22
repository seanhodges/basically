/**
 * Pins the shared page map to the registry, so the crosscheck batteries that
 * loop over it really do loop over every machine.
 *
 * This is the one place the reference tree's page list meets the dialect list.
 * Everything else that needs "the tables, per page" imports ./pages, so a
 * machine registered without its reference page fails here once rather than
 * being silently skipped by nine batteries at once - which is what each of them
 * used to do with a hand-maintained map of its own.
 *
 * Only that a page exists is pinned here. What each page *says* is pinned per
 * machine by keyword-crosscheck.test.ts and escapes/escape-crosscheck.test.ts.
 *
 * Like the sibling crosschecks this file reaches the dialect registry freely:
 * vitest runs it in node, and no bundle includes a `*.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { dialects } from '../dialects/registry';
import { escapePages, referencePageOf, referencePages } from './pages';

const pages = new Set(dialects.map((d) => referencePageOf(d)));

describe('the shared reference page map', () => {
  it('carries a keyword table for every registered machine', () => {
    const missing = [...pages].filter((p) => !referencePages[p]);
    expect(
      missing,
      'add the page to referencePages in src/reference/pages.ts',
    ).toEqual([]);
  });

  it('carries a control-code table for every registered machine', () => {
    const missing = [...pages].filter((p) => !escapePages[p]);
    expect(
      missing,
      'add the page to escapePages in src/reference/pages.ts',
    ).toEqual([]);
  });

  // A page no machine reads from is a page nobody can reach, so a battery
  // looping over the map would be measuring documentation for a machine that
  // is not registered any more.
  it('carries no page no machine reads from', () => {
    expect(Object.keys(referencePages).filter((p) => !pages.has(p))).toEqual(
      [],
    );
    expect(Object.keys(escapePages).filter((p) => !pages.has(p))).toEqual([]);
  });

  it('keys both maps the same way', () => {
    expect(Object.keys(escapePages).sort()).toEqual(
      Object.keys(referencePages).sort(),
    );
  });
});
