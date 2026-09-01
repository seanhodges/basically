import { describe, expect, it } from 'vitest';
import { ESCAPE_CLASSES } from '../escape-classes';
import { escapePages } from '../pages';

const SETS = Object.entries(escapePages);

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

  // One catch-all *per machine*: a byte no row claims falls to the rest row, so
  // two of them reachable from one machine would leave the fall-through
  // undecided. A page whose machines do not share a charset carries one each -
  // the ZX81 spells a raw byte `\{NN}` and the Spectrums `{0xNN}` - so the rule
  // is that the rest rows are scoped and no machine is named by two of them.
  it('has at most one catch-all (rest) row per machine', () => {
    const rest = data.entries.filter((e) => e.codes === 'rest');
    if (rest.length <= 1) return;
    const claimed = new Set<string>();
    for (const row of rest) {
      expect(
        row.onlyOn,
        `${row.escape} is a second catch-all, unscoped`,
      ).toBeTruthy();
      for (const id of row.onlyOn ?? []) {
        expect(claimed.has(id), `${id} has two catch-alls`).toBe(false);
        claimed.add(id);
      }
    }
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
