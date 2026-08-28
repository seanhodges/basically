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
import {
  escapePages,
  PENDING_PAGE_IDS,
  referencePageOf,
  referencePages,
} from './pages';

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
    const stale = (map: Record<string, unknown>) =>
      Object.keys(map).filter(
        (p) => !pages.has(p) && !PENDING_PAGE_IDS.includes(p),
      );
    expect(stale(referencePages)).toEqual([]);
    expect(stale(escapePages)).toEqual([]);
  });

  // The pending list is what lets a machine's documentation be written and
  // checked before it is registered. It has to name a real page, and it has to
  // be emptied by the change that registers the machines - otherwise it would
  // quietly restore the hole the assertion above exists to close.
  it('lists only real pages as pending', () => {
    for (const page of PENDING_PAGE_IDS) {
      expect(
        referencePages[page],
        `${page} is not a keyword table`,
      ).toBeDefined();
      expect(
        escapePages[page],
        `${page} is not a control-code table`,
      ).toBeDefined();
    }
  });

  it('lists no page as pending once a machine reads from it', () => {
    expect(
      PENDING_PAGE_IDS.filter((p) => pages.has(p)),
      'remove these from PENDING_PAGE_IDS in src/reference/pages.ts',
    ).toEqual([]);
  });

  it('keys both maps the same way', () => {
    expect(Object.keys(escapePages).sort()).toEqual(
      Object.keys(referencePages).sort(),
    );
  });
});
