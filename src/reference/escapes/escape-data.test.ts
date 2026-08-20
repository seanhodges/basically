import { describe, expect, it } from 'vitest';
import type { EscapeTableData } from '../types';
import { ESCAPE_CLASSES } from '../escape-classes';
import { altair8800Escapes } from './altair8800';
import { pmd85Escapes } from './pmd85';
import { zx81Escapes } from './zx81';
import { zx80Escapes } from './zx80';
import { zxspectrumEscapes } from './zxspectrum';
import { bbcEscapes } from './bbc';
import { commodoreEscapes } from './commodore';
import { trs80Escapes } from './trs80';
import { atomEscapes } from './atom';
import { cpcEscapes } from './cpc';

const SETS: [string, EscapeTableData][] = [
  ['zx81', zx81Escapes],
  ['zx80', zx80Escapes],
  ['zxspectrum', zxspectrumEscapes],
  ['bbc', bbcEscapes],
  ['commodore', commodoreEscapes],
  ['trs80', trs80Escapes],
  ['atom', atomEscapes],
  ['cpc', cpcEscapes],
  ['altair8800', altair8800Escapes],
  ['pmd85', pmd85Escapes],
];

describe.each(SETS)('escape data: %s', (_id, data) => {
  it('has a title, machine list, categories and entries', () => {
    expect(data.title).toBeTruthy();
    expect(data.machines.length).toBeGreaterThan(0);
    expect(data.categories.length).toBeGreaterThan(0);
    expect(data.entries.length).toBeGreaterThan(0);
  });

  it('every entry is structurally complete', () => {
    const catIds = new Set(data.categories.map((c) => c.id));
    for (const e of data.entries) {
      expect(e.escape, 'escape').toBeTruthy();
      expect(e.bytes, `bytes for ${e.escape}`).toBeTruthy();
      expect(catIds.has(e.category), `category for ${e.escape}`).toBe(true);
      expect(
        e.description.length,
        `description for ${e.escape}`,
      ).toBeGreaterThan(0);
      expect(e.example.source, `example for ${e.escape}`).toBeTruthy();
      expect(
        e.example.bytes.length,
        `example bytes for ${e.escape}`,
      ).toBeGreaterThan(0);
    }
  });

  it('has no duplicate escape spellings', () => {
    const names = data.entries.map((e) => e.escape);
    expect(new Set(names).size).toBe(names.length);
  });

  it('has at most one catch-all (rest) row', () => {
    const rest = data.entries.filter((e) => e.codes === 'rest');
    expect(rest.length).toBeLessThanOrEqual(1);
  });

  it('every category has at least one entry', () => {
    for (const c of data.categories) {
      expect(
        data.entries.some((e) => e.category === c.id),
        `entries for category ${c.id}`,
      ).toBe(true);
    }
  });

  it('every category declares a class from the shared vocabulary', () => {
    for (const c of data.categories) {
      expect(
        ESCAPE_CLASSES as readonly string[],
        `"${c.class}" on category ${c.id} is not in the class vocabulary`,
      ).toContain(c.class);
    }
  });
});

// A class no page classifies anything as is as much a defect as a category with
// no class: nothing can ever be reported under it, so the guidance table would
// carry a cell that cannot be reached and the vocabulary would read as a wish
// list rather than a description of the tables.
it('every class in the vocabulary is used by at least one page', () => {
  const used = new Set(
    SETS.flatMap(([, data]) => data.categories.map((c) => c.class)),
  );
  for (const cls of ESCAPE_CLASSES) {
    expect(used, `no page classifies any category as "${cls}"`).toContain(cls);
  }
});
