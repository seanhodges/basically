/**
 * Pins escape-guidance.ts to the real escape data, modelled on
 * domain-guidance-crosscheck.test.ts. Completeness is derived from the real
 * diff rather than a hand-maintained list: which (target, class) cells are
 * mandatory is computed by running the real `diffEscapes` across every source
 * page, so a cell here either answers a question the comparison can actually
 * ask, or these tests reject it as dead.
 */
import { describe, expect, it } from 'vitest';
import { diffEscapes } from './compare';
import { altair8800Escapes } from './escapes/altair8800';
import { atomEscapes } from './escapes/atom';
import { bbcEscapes } from './escapes/bbc';
import { commodoreEscapes } from './escapes/commodore';
import { cpcEscapes } from './escapes/cpc';
import { trs80Escapes } from './escapes/trs80';
import { zx80Escapes } from './escapes/zx80';
import { zx81Escapes } from './escapes/zx81';
import { zxspectrumEscapes } from './escapes/zxspectrum';
import { escapeGuidance } from './escape-guidance';
import { ESCAPE_CLASSES } from './escape-classes';
import type { EscapeClass } from './escape-classes';
import type { EscapeTableData } from './types';

const PAGES: Record<string, EscapeTableData> = {
  altair8800: altair8800Escapes,
  atom: atomEscapes,
  bbc: bbcEscapes,
  commodore: commodoreEscapes,
  cpc: cpcEscapes,
  trs80: trs80Escapes,
  zx80: zx80Escapes,
  zx81: zx81Escapes,
  zxspectrum: zxspectrumEscapes,
};
const IDS = Object.keys(PAGES);

// The same reading budget the capability guidance is held to: this renders
// inline against a group the reader is already scanning.
export const MAX_INSTEAD_CHARS = 200;
export const MAX_EXAMPLE_LINES = 5;
export const MAX_EXAMPLE_LINE_CHARS = 40;
export const MAX_CAPTION_CHARS = 60;

/** Classes the page files at least one of its own categories under. */
function classesOnPage(id: string): Set<EscapeClass> {
  return new Set(PAGES[id]!.categories.map((c) => c.class));
}

/** Classes some other source page can lose codes from when porting into this target. */
function losableClasses(to: string): Set<EscapeClass> {
  const losable = new Set<EscapeClass>();
  for (const from of IDS) {
    if (from === to) continue;
    const classOf = new Map(
      PAGES[from]!.categories.map((c) => [c.id, c.class]),
    );
    for (const entry of diffEscapes(PAGES[from]!, PAGES[to]!).mustReplace) {
      const cls = classOf.get(entry.category);
      // A row whose category the page never declares is caught by
      // escapes/escape-data.test.ts; here it simply contributes nothing.
      if (cls) losable.add(cls);
    }
  }
  return losable;
}

const cellsByKey = new Map(
  escapeGuidance.map((g) => [`${g.to}:${g.class}`, g]),
);

describe('escape guidance: structural validity', () => {
  it('names only real target pages', () => {
    for (const g of escapeGuidance) {
      expect(IDS, `"${g.to}" is not a real escape page slug`).toContain(g.to);
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

  it('has no duplicate (to, class) cell', () => {
    const keys = escapeGuidance.map((g) => `${g.to}:${g.class}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe.each(IDS)('escape guidance for %s', (to) => {
  const losable = losableClasses(to);

  it('has a cell for every class a source can lose into it', () => {
    for (const cls of losable) {
      expect(
        cellsByKey.get(`${to}:${cls}`)?.instead,
        `${to} has no advice for ${cls} control codes, which some source loses into it`,
      ).toBeTruthy();
    }
  });

  it('carries no dead cell — every cell answers a question some pair asks', () => {
    for (const cls of ESCAPE_CLASSES) {
      if (!cellsByKey.has(`${to}:${cls}`)) continue;
      expect(
        losable.has(cls),
        `${to}/${cls} carries advice but no source loses a ${cls} code into it`,
      ).toBe(true);
    }
  });
});

describe.each(escapeGuidance.map((g) => [`${g.to}/${g.class}`, g] as const))(
  'escape guidance cell: %s',
  (_key, g) => {
    it('reports support honestly', () => {
      // A page that files one of its own categories under this class plainly
      // has some way to express it, so "nothing like it" would be a lie. The
      // converse does not hold and is not checked: the CPC's mosaics and the
      // Spectrum's {INK n} are real support filed under another class.
      if (g.support === 'none') {
        expect(
          classesOnPage(g.to),
          `${g.to} claims no ${g.class} support but files a category of its own under that class`,
        ).not.toContain(g.class);
      }
    });

    it('stays within the reading budget', () => {
      expect(g.instead.length).toBeGreaterThan(0);
      expect(
        g.instead.length,
        `too long to scan: "${g.instead}"`,
      ).toBeLessThanOrEqual(MAX_INSTEAD_CHARS);
      if (g.example) {
        expect(g.example.caption.length).toBeGreaterThan(0);
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
  },
);
