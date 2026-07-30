/**
 * Pins domain-guidance.ts to the real dialect data, modelled on
 * porting-crosscheck.test.ts. Completeness is derived from the real diff
 * rather than a hand-maintained list: which (target, capability) cells are
 * mandatory is computed by running the real `diffKeywords` across every
 * source dialect, so a cell here either answers a question the comparison can
 * actually ask, or these tests reject it as dead.
 */
import { describe, expect, it } from 'vitest';
import { diffKeywords } from '../../.vitepress/theme/dialectCompare';
import { atomReference } from './atom';
import { bbcReference } from './bbc';
import { commodoreReference } from './commodore';
import { cpcReference } from './cpc';
import { trs80Reference } from './trs80';
import { zx80Reference } from './zx80';
import { zx81Reference } from './zx81';
import { zxspectrumReference } from './zxspectrum';
import { keywordEquivalences } from './porting';
import { domainGuidance } from './domain-guidance';
import { KEYWORD_DOMAINS } from './domains';
import type { KeywordDomain } from './domains';
import type { BasicReferenceTableData } from './types';

const PAGES: Record<string, BasicReferenceTableData> = {
  atom: atomReference,
  bbc: bbcReference,
  commodore: commodoreReference,
  cpc: cpcReference,
  trs80: trs80Reference,
  zx80: zx80Reference,
  zx81: zx81Reference,
  zxspectrum: zxspectrumReference,
};
const IDS = Object.keys(PAGES);

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

/** Domains some other source dialect can lose when porting into this target. */
function losableDomains(to: string): Set<KeywordDomain> {
  const losable = new Set<KeywordDomain>();
  for (const from of IDS) {
    if (from === to) continue;
    const diff = diffKeywords(PAGES[from]!, PAGES[to]!, {
      from,
      to,
      equivalences: keywordEquivalences,
    });
    for (const entry of diff.mustReplace) losable.add(entry.domain);
  }
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

describe.each(IDS)('domain guidance for %s', (to) => {
  const present = domainsOnTarget(to);
  const losable = losableDomains(to);

  it('has a cell with `instead` for every domain a source can lose into it', () => {
    for (const domain of losable) {
      const cell = cellsByKey.get(`${to}:${domain}`);
      expect(
        cell?.instead,
        `${to} has no "instead" advice for ${domain}, which some source loses into it`,
      ).toBeTruthy();
    }
  });

  it('has a cell with `summary` for every domain it provides at least one command in', () => {
    for (const domain of present) {
      const cell = cellsByKey.get(`${to}:${domain}`);
      expect(
        cell?.summary,
        `${to} has no "summary" for ${domain}, which it has commands in`,
      ).toBeTruthy();
    }
  });

  it('carries no dead cell — every cell is either present on the target or losable into it', () => {
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
  });
});

describe.each(domainGuidance.map((g) => [`${g.to}/${g.domain}`, g] as const))(
  'domain guidance cell: %s',
  (_key, g) => {
    const present = domainsOnTarget(g.to);

    it('reports support honestly', () => {
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
    });

    it('shows an example exactly when support is not full and instead is set', () => {
      const shouldHaveExample = g.support !== 'full' && Boolean(g.instead);
      expect(Boolean(g.example)).toBe(shouldHaveExample);
    });

    it('pins every reachFor name to a real row on the target page in this domain', () => {
      for (const name of g.reachFor ?? []) {
        const row = PAGES[g.to]!.entries.find((e) => e.name === name);
        expect(row, `${g.to} has no "${name}" row`).toBeTruthy();
        expect(
          row?.domain,
          `${g.to}'s "${name}" is not in the ${g.domain} domain`,
        ).toBe(g.domain);
      }
      expect(g.reachFor?.length ?? 0).toBeLessThanOrEqual(MAX_REACH_FOR);
    });

    it('stays within the reading budget', () => {
      expect(g.summary.length).toBeGreaterThan(0);
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
        expect(g.example.caption.length).toBeLessThanOrEqual(MAX_CAPTION_CHARS);
        expect(g.example.code.length).toBeGreaterThan(0);
        expect(g.example.code.length).toBeLessThanOrEqual(MAX_EXAMPLE_LINES);
        for (const line of g.example.code) {
          expect(
            line.length,
            `example line too long: "${line}"`,
          ).toBeLessThanOrEqual(MAX_EXAMPLE_LINE_CHARS);
        }
      }
    });

    it('only claims a domain present on the target or losable into it', () => {
      const losable = losableDomains(g.to);
      expect(present.has(g.domain) || losable.has(g.domain)).toBe(true);
    });
  },
);
