/**
 * Pins domain-guidance.ts to the real dialect data, modelled on
 * porting-crosscheck.test.ts. Completeness is derived from the real diff
 * rather than a hand-maintained list: which (target, capability) cells are
 * mandatory is computed by running the real `diffKeywords` across every
 * source dialect, so a cell here either answers a question the comparison can
 * actually ask, or these tests reject it as dead.
 */
import { describe, expect, it } from 'vitest';
import { diffKeywords, tableForMachine } from './compare';
import { referencePages as PAGES } from './pages';
import { keywordEquivalences } from './porting';
import { domainGuidance } from './domain-guidance';
import { KEYWORD_DOMAINS } from './domains';
import type { KeywordDomain } from './domains';
import type { BasicReferenceTableData } from './types';
import { dialects } from '../dialects/registry';
import { referencePageOf } from '../dialects/referencePage';

/**
 * Every registered machine, which is what a guidance cell advises. Reading the
 * page instead would let a cell claiming the target has no support in a
 * capability pass on a relative's rows, and let it reach for a command only
 * that relative has.
 */
const IDS = dialects.map((d) => d.id);

/** Every cell's targets, expanded - a cell may name several machines. */
const targetsOf = (cell: (typeof domainGuidance)[number]): readonly string[] =>
  typeof cell.to === 'string' ? [cell.to] : cell.to;

/**
 * The machine's own rows: its page narrowed to it. Memoised alongside the
 * losable set below, because the sweep asks for each machine's table once per
 * source it diffs against - 21 targets against 20 sources apiece.
 */
const tableCache = new Map<string, BasicReferenceTableData>();
function tableFor(id: string): BasicReferenceTableData {
  const cached = tableCache.get(id);
  if (cached) return cached;
  const dialect = dialects.find((d) => d.id === id);
  if (!dialect) throw new Error(`unknown dialect: ${id}`);
  const table = tableForMachine(PAGES[referencePageOf(dialect)]!, id);
  tableCache.set(id, table);
  return table;
}

// The reading budget from the change proposal, made mechanical. This table is
// read inline against a group the reader is already scanning, so it is capped
// harder than the existing prose budgets in porting-crosscheck.test.ts.
export const MAX_SUMMARY_CHARS = 160;
export const MAX_INSTEAD_CHARS = 200;
export const MAX_EXAMPLE_LINES = 5;
export const MAX_EXAMPLE_LINE_CHARS = 40;
export const MAX_CAPTION_CHARS = 60;
export const MAX_REACH_FOR = 4;

/** Domains the target machine has at least one command of its own in. */
function domainsOnTarget(id: string): Set<KeywordDomain> {
  return new Set(tableFor(id).entries.map((e) => e.domain));
}

/**
 * Domains some other source machine can lose when porting into this target.
 *
 * Memoised because it diffs every source machine against the target, and the
 * checks below ask for the same target once per guidance cell.
 */
const losableCache = new Map<string, Set<KeywordDomain>>();
function losableDomains(to: string): Set<KeywordDomain> {
  const cached = losableCache.get(to);
  if (cached) return cached;
  const losable = new Set<KeywordDomain>();
  for (const from of IDS) {
    if (from === to) continue;
    const diff = diffKeywords(tableFor(from), tableFor(to), {
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
  domainGuidance.flatMap((g) =>
    targetsOf(g).map((to) => [`${to}:${g.domain}`, g] as const),
  ),
);

describe('domain guidance: structural validity', () => {
  it('names only real target machines', () => {
    for (const g of domainGuidance) {
      for (const to of targetsOf(g)) {
        expect(IDS, `"${to}" is not a registered machine`).toContain(to);
      }
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

  // Expanded to machines: two cells naming overlapping lists would leave the
  // comparison showing whichever came first.
  it('has no duplicate (to, domain) cell', () => {
    const keys = domainGuidance.flatMap((g) =>
      targetsOf(g).map((to) => `${to}:${g.domain}`),
    );
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
      for (const to of targetsOf(g)) {
        const count = tableFor(to).entries.filter(
          (e) => e.domain === g.domain,
        ).length;
        if (g.support === 'none') {
          expect(
            count,
            `${to} claims no ${g.domain} support but has a command of its own there`,
          ).toBe(0);
        }
        if (g.support === 'full') {
          expect(
            count,
            `${to} claims full ${g.domain} support but has no command there`,
          ).toBeGreaterThan(0);
        }
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

  // Against the machine's own rows, not its page's: a command a relative has
  // and this machine does not reads perfectly here and sends the reader to
  // something their machine has never had.
  it('pins every reachFor name to a row the target machine itself has in this domain', () => {
    for (const g of domainGuidance) {
      for (const to of targetsOf(g)) {
        for (const name of g.reachFor ?? []) {
          const row = tableFor(to).entries.find((e) => e.name === name);
          expect(row, `${to} has no "${name}" row of its own`).toBeTruthy();
          expect(
            row?.domain,
            `${to}'s "${name}" is not in the ${g.domain} domain`,
          ).toBe(g.domain);
        }
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
      for (const to of targetsOf(g)) {
        expect(
          domainsOnTarget(to).has(g.domain) || losableDomains(to).has(g.domain),
          `${to}/${g.domain} is claimed but the target neither has that domain nor can lose into it`,
        ).toBe(true);
      }
    }
  });
});
