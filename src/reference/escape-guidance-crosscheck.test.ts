/**
 * Pins escape-guidance.ts to the real escape data, modelled on
 * domain-guidance-crosscheck.test.ts. Completeness is derived from the real
 * diff rather than a hand-maintained list: which (target, class) cells are
 * mandatory is computed by running the real `diffEscapes` across every source
 * page, so a cell here either answers a question the comparison can actually
 * ask, or these tests reject it as dead.
 */
import { describe, expect, it } from 'vitest';
import { diffEscapes, escapeTableForMachine } from './compare';
import { escapePages as PAGES } from './pages';
import { escapeGuidance } from './escape-guidance';
import { ESCAPE_CLASSES } from './escape-classes';
import type { EscapeClass } from './escape-classes';
import type { EscapeTableData } from './types';
import { dialects } from '../dialects/registry';
import { referencePageOf } from '../dialects/referencePage';

/**
 * Every registered machine, which is what a guidance cell advises. Machines
 * sharing a page need not share a charset - the Sinclair page carries the
 * ZX81's block graphics and the Spectrum's colour directives both - so a claim
 * checked against the page would pass on a relative's codes.
 */
const IDS = dialects.map((d) => d.id);

/** Every cell's targets, expanded - a cell may name several machines. */
const targetsOf = (cell: (typeof escapeGuidance)[number]): readonly string[] =>
  typeof cell.to === 'string' ? [cell.to] : cell.to;

/** The machine's own control codes: its page's escape table narrowed to it. */
const tableCache = new Map<string, EscapeTableData>();
function tableFor(id: string): EscapeTableData {
  const cached = tableCache.get(id);
  if (cached) return cached;
  const dialect = dialects.find((d) => d.id === id);
  if (!dialect) throw new Error(`unknown dialect: ${id}`);
  const table = escapeTableForMachine(PAGES[referencePageOf(dialect)]!, id);
  tableCache.set(id, table);
  return table;
}

// The same reading budget the capability guidance is held to: this renders
// inline against a group the reader is already scanning.
export const MAX_INSTEAD_CHARS = 200;
export const MAX_EXAMPLE_LINES = 5;
export const MAX_EXAMPLE_LINE_CHARS = 40;
export const MAX_CAPTION_CHARS = 60;

/**
 * Classes the machine has at least one control code of its own under. A page
 * declares its categories for all its machines, so the codes decide this, not
 * the category list.
 */
function classesOnMachine(id: string): Set<EscapeClass> {
  const table = tableFor(id);
  const classOf = new Map(table.categories.map((c) => [c.id, c.class]));
  const classes = new Set<EscapeClass>();
  for (const entry of table.entries) {
    const cls = classOf.get(entry.category);
    if (cls) classes.add(cls);
  }
  return classes;
}

/**
 * Classes some other source machine can lose codes from when porting into this
 * target. Memoised for the reason the capability sweep's twin is: it diffs
 * every source machine against the target, once per cell that names it.
 */
const losableCache = new Map<string, Set<EscapeClass>>();
function losableClasses(to: string): Set<EscapeClass> {
  const cached = losableCache.get(to);
  if (cached) return cached;
  const losable = new Set<EscapeClass>();
  for (const from of IDS) {
    if (from === to) continue;
    const classOf = new Map(
      tableFor(from).categories.map((c) => [c.id, c.class]),
    );
    for (const entry of diffEscapes(tableFor(from), tableFor(to)).mustReplace) {
      const cls = classOf.get(entry.category);
      // A row whose category the page never declares is caught by
      // escapes/escape-data.test.ts; here it simply contributes nothing.
      if (cls) losable.add(cls);
    }
  }
  losableCache.set(to, losable);
  return losable;
}

const cellsByKey = new Map(
  escapeGuidance.flatMap((g) =>
    targetsOf(g).map((to) => [`${to}:${g.class}`, g] as const),
  ),
);

describe('escape guidance: structural validity', () => {
  it('names only real target machines', () => {
    for (const g of escapeGuidance) {
      for (const to of targetsOf(g)) {
        expect(IDS, `"${to}" is not a registered machine`).toContain(to);
      }
    }
  });

  it('names only real control-code classes', () => {
    for (const g of escapeGuidance) {
      expect(
        ESCAPE_CLASSES as readonly string[],
        `"${g.class}" is not in the class vocabulary`,
      ).toContain(g.class);
    }
  });

  // Expanded to machines, so two cells naming overlapping lists cannot both
  // claim one machine's class.
  it('has no duplicate (to, class) cell', () => {
    const keys = escapeGuidance.flatMap((g) =>
      targetsOf(g).map((to) => `${to}:${g.class}`),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('escape guidance covers every target', () => {
  it('has a cell for every class a source can lose into it', () => {
    for (const to of IDS) {
      for (const cls of losableClasses(to)) {
        expect(
          cellsByKey.get(`${to}:${cls}`)?.instead,
          `${to} has no advice for ${cls} control codes, which some source loses into it`,
        ).toBeTruthy();
      }
    }
  });

  it('carries no dead cell — every cell answers a question some pair asks', () => {
    for (const to of IDS) {
      const losable = losableClasses(to);
      for (const cls of ESCAPE_CLASSES) {
        if (!cellsByKey.has(`${to}:${cls}`)) continue;
        expect(
          losable.has(cls),
          `${to}/${cls} carries advice but no source loses a ${cls} code into it`,
        ).toBe(true);
      }
    }
  });
});

describe('every escape guidance cell', () => {
  it('reports support honestly', () => {
    // A machine with a control code of its own under this class plainly has
    // some way to express it, so "nothing like it" would be a lie. The
    // converse does not hold and is not checked: the CPC's mosaics and the
    // Spectrum's {INK n} are real support filed under another class.
    for (const g of escapeGuidance) {
      for (const to of targetsOf(g)) {
        if (g.support === 'none') {
          expect(
            classesOnMachine(to),
            `${to} claims no ${g.class} support but has a control code of its own under that class`,
          ).not.toContain(g.class);
        }
      }
    }
  });

  it('stays within the reading budget', () => {
    for (const g of escapeGuidance) {
      expect(
        g.instead.length,
        `${g.to}/${g.class} has no advice at all`,
      ).toBeGreaterThan(0);
      expect(
        g.instead.length,
        `too long to scan: "${g.instead}"`,
      ).toBeLessThanOrEqual(MAX_INSTEAD_CHARS);
      if (g.example) {
        expect(
          g.example.caption.length,
          `${g.to}/${g.class} has an empty caption`,
        ).toBeGreaterThan(0);
        expect(
          g.example.caption.length,
          `${g.to}/${g.class} caption too long`,
        ).toBeLessThanOrEqual(MAX_CAPTION_CHARS);
        expect(
          g.example.code.length,
          `${g.to}/${g.class} has an empty example`,
        ).toBeGreaterThan(0);
        expect(
          g.example.code.length,
          `${g.to}/${g.class} example runs over ${MAX_EXAMPLE_LINES} lines`,
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
});
