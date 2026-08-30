/**
 * Pins domain-guidance.ts to the real dialect data, modelled on
 * porting-crosscheck.test.ts. Completeness is derived from the real diff
 * rather than a hand-maintained list: which (target, capability) cells are
 * mandatory is computed by running the real `diffKeywords` across every
 * source dialect, so a cell here either answers a question the comparison can
 * actually ask, or these tests reject it as dead.
 */
import { describe, expect, it } from 'vitest';
import { diffKeywords } from './compare';
import { REFERENCE_PAGE_IDS, referencePages as PAGES } from './pages';
import { keywordEquivalences } from './porting';
import { domainGuidance } from './domain-guidance';
import { KEYWORD_DOMAINS } from './domains';
import type { KeywordDomain } from './domains';

const IDS = REFERENCE_PAGE_IDS;

// The reading budget from the change proposal, made mechanical. This table is
// read inline against a group the reader is already scanning, so it is capped
// harder than the existing prose budgets in porting-crosscheck.test.ts.
export const MAX_SUMMARY_CHARS = 160;
export const MAX_INSTEAD_CHARS = 200;
export const MAX_EXAMPLE_LINES = 5;
export const MAX_EXAMPLE_LINE_CHARS = 40;
export const MAX_CAPTION_CHARS = 60;
export const MAX_REACH_FOR = 4;

/** Domains the target has at least one command in. */
function domainsOnTarget(id: string): Set<KeywordDomain> {
  return new Set(PAGES[id]!.entries.map((e) => e.domain));
}

/**
 * Domains some other source dialect can lose when porting into this target.
 *
 * Memoised because it diffs every source page against the target, and the
 * checks below ask for the same target once per guidance cell.
 */
const losableCache = new Map<string, Set<KeywordDomain>>();
function losableDomains(to: string): Set<KeywordDomain> {
  const cached = losableCache.get(to);
  if (cached) return cached;
  const losable = new Set<KeywordDomain>();
  for (const from of IDS) {
    if (from === to) continue;
    const diff = diffKeywords(PAGES[from]!, PAGES[to]!, {
      from,
      to,
      equivalences: keywordEquivalences,
    });
    // `domain` is optional on a reference row in general; every BASIC row
    // carries one, so the guard never skips anything here - it is what lets
    // the docs project typecheck this file at all.
    for (const entry of diff.mustReplace) {
      if (entry.domain) losable.add(entry.domain);
    }
  }
  losableCache.set(to, losable);
  return losable;
}

const cellsByKey = new Map(
  domainGuidance.map((g) => [`${g.to}:${g.domain}`, g]),
);

describe('domain guidance: structural validity', () => {
  it('names only real target pages', () => {
    for (const g of domainGuidance) {
      expect(IDS, `"${g.to}" is not a real page slug`).toContain(g.to);
    }
  });

  it('names only real capability domains', () => {
    for (const g of domainGuidance) {
      expect(
        KEYWORD_DOMAINS as readonly string[],
        `"${g.domain}" is not in the capability vocabulary`,
      ).toContain(g.domain);
    }
  });

  it('has no duplicate (to, domain) cell', () => {
    const keys = domainGuidance.map((g) => `${g.to}:${g.domain}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('domain guidance covers every target', () => {
  it('has a cell with `instead` for every domain a source can lose into it', () => {
    for (const to of IDS) {
      for (const domain of losableDomains(to)) {
        const cell = cellsByKey.get(`${to}:${domain}`);
        expect(
          cell?.instead,
          `${to} has no "instead" advice for ${domain}, which some source loses into it`,
        ).toBeTruthy();
      }
    }
  });

  it('has a cell with `summary` for every domain it provides at least one command in', () => {
    for (const to of IDS) {
      for (const domain of domainsOnTarget(to)) {
        const cell = cellsByKey.get(`${to}:${domain}`);
        expect(
          cell?.summary,
          `${to} has no "summary" for ${domain}, which it has commands in`,
        ).toBeTruthy();
      }
    }
  });

  it('carries no dead cell — every cell is either present on the target or losable into it', () => {
    for (const to of IDS) {
      const present = domainsOnTarget(to);
      const losable = losableDomains(to);
      for (const domain of KEYWORD_DOMAINS) {
        const cell = cellsByKey.get(`${to}:${domain}`);
        if (!cell) continue;
        const isPresent = present.has(domain);
        const isLosable = losable.has(domain);
        expect(
          isPresent || isLosable,
          `${to}/${domain} is neither present on the target nor losable into it — nothing can arise for this cell`,
        ).toBe(true);
        if (cell.instead) {
          expect(
            isLosable,
            `${to}/${domain} carries "instead" advice but nothing is losable into it there`,
          ).toBe(true);
        }
      }
    }
  });
});

describe('every domain guidance cell', () => {
  it('reports support honestly', () => {
    for (const g of domainGuidance) {
      const count = [...PAGES[g.to]!.entries].filter(
        (e) => e.domain === g.domain,
      ).length;
      if (g.support === 'none') {
        expect(
          count,
          `${g.to} claims no ${g.domain} support but its own page lists one`,
        ).toBe(0);
      }
      if (g.support === 'full') {
        expect(
          count,
          `${g.to} claims full ${g.domain} support but has no command there`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('shows an example exactly when support is not full and instead is set', () => {
    for (const g of domainGuidance) {
      const shouldHaveExample = g.support !== 'full' && Boolean(g.instead);
      expect(
        Boolean(g.example),
        shouldHaveExample
          ? `${g.to}/${g.domain} needs an example: it is not full support and carries "instead"`
          : `${g.to}/${g.domain} carries an example it should not have`,
      ).toBe(shouldHaveExample);
    }
  });

  it('pins every reachFor name to a real row on the target page in this domain', () => {
    for (const g of domainGuidance) {
      for (const name of g.reachFor ?? []) {
        const row = PAGES[g.to]!.entries.find((e) => e.name === name);
        expect(row, `${g.to} has no "${name}" row`).toBeTruthy();
        expect(
          row?.domain,
          `${g.to}'s "${name}" is not in the ${g.domain} domain`,
        ).toBe(g.domain);
      }
      expect(
        g.reachFor?.length ?? 0,
        `${g.to}/${g.domain} points at more than ${MAX_REACH_FOR} rows`,
      ).toBeLessThanOrEqual(MAX_REACH_FOR);
    }
  });

  it('stays within the reading budget', () => {
    for (const g of domainGuidance) {
      expect(
        g.summary.length,
        `${g.to}/${g.domain} has an empty summary`,
      ).toBeGreaterThan(0);
      expect(
        g.summary.length,
        `too long to scan: "${g.summary}"`,
      ).toBeLessThanOrEqual(MAX_SUMMARY_CHARS);
      if (g.instead) {
        expect(
          g.instead.length,
          `too long to scan: "${g.instead}"`,
        ).toBeLessThanOrEqual(MAX_INSTEAD_CHARS);
      }
      if (g.example) {
        expect(
          g.example.caption.length,
          `${g.to}/${g.domain} caption too long`,
        ).toBeLessThanOrEqual(MAX_CAPTION_CHARS);
        expect(
          g.example.code.length,
          `${g.to}/${g.domain} has an empty example`,
        ).toBeGreaterThan(0);
        expect(
          g.example.code.length,
          `${g.to}/${g.domain} example runs over ${MAX_EXAMPLE_LINES} lines`,
        ).toBeLessThanOrEqual(MAX_EXAMPLE_LINES);
        for (const line of g.example.code) {
          expect(
            line.length,
            `example line too long: "${line}"`,
          ).toBeLessThanOrEqual(MAX_EXAMPLE_LINE_CHARS);
        }
      }
    }
  });

  it('only claims a domain present on the target or losable into it', () => {
    for (const g of domainGuidance) {
      const present = domainsOnTarget(g.to);
      const losable = losableDomains(g.to);
      expect(
        present.has(g.domain) || losable.has(g.domain),
        `${g.to}/${g.domain} is claimed but the target neither has that domain nor can lose into it`,
      ).toBe(true);
    }
  });
});
