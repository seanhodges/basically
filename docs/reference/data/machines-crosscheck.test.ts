/**
 * Pins the comparison's machine list to the dialect registry, so the porting
 * guide cannot fall behind the IDE.
 *
 * The docs runtime may never import `src/` - the registry pulls in every
 * emulator core - so `machines.ts` restates what the registry knows. This file
 * is what makes that restatement safe: a newly registered dialect, a renamed
 * machine or a changed `docsReference` fails here until `machines.ts` agrees.
 *
 * Like the sibling crosschecks it imports `src/` freely: vitest runs it in node
 * and the VitePress bundle never includes *.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { dialects } from '../../../src/dialects/registry';
import {
  families,
  machineForSelection,
  machines,
  pageForSelection,
  selectableIds,
} from './machines';

const registryIds = dialects.map((d) => d.id).sort();

describe('machine list', () => {
  it('offers every registered dialect, and only those', () => {
    expect(machines.map((m) => m.id).sort()).toEqual(registryIds);
  });

  it.each(dialects.map((d) => [d.id, d] as const))(
    '%s carries the dialect name and docs page',
    (id, dialect) => {
      const choice = machines.find((m) => m.id === id);
      expect(choice).toBeDefined();
      expect(choice!.label).toBe(dialect.name);
      expect(choice!.page).toBe(dialect.docsReference ?? dialect.id);
    },
  );
});

describe('families', () => {
  it('names only registered machines as members', () => {
    for (const family of families) {
      for (const member of family.members) {
        expect(registryIds, `${family.slug} member ${member}`).toContain(
          member,
        );
      }
    }
  });

  it('covers every page that more than one machine shares', () => {
    const byPage = new Map<string, string[]>();
    for (const m of machines) {
      byPage.set(m.page, [...(byPage.get(m.page) ?? []), m.id]);
    }
    const shared = [...byPage.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([page]) => page)
      .sort();
    expect(families.map((f) => f.page).sort()).toEqual(shared);
  });

  it('lists exactly the machines on its page', () => {
    for (const family of families) {
      const onPage = machines
        .filter((m) => m.page === family.page)
        .map((m) => m.id)
        .sort();
      expect([...family.members].sort(), family.slug).toEqual(onPage);
    }
  });

  it('says in its label that it covers more than one machine', () => {
    // The spec requires a family selection be distinguishable from a single
    // machine. The convention is a trailing parenthetical opening with "either"
    // or "any" - what follows names whatever reads best for that family
    // ("either machine", "either CPC"), so the check pins the promise, not the
    // wording.
    for (const family of families) {
      expect(family.label, family.slug).toMatch(/\((?:either|any) .*\)$/);
    }
  });
});

describe('selection namespace', () => {
  // A family slug that collided with a machine id would make ?from= ambiguous.
  // `zxspectrum` is the near miss: it is the 48K machine's dialect id, so its
  // family is slugged `zxspectrum-any`.
  it('keeps machine ids and family slugs disjoint', () => {
    const ids = new Set(machines.map((m) => m.id));
    for (const family of families) {
      expect(
        ids.has(family.slug),
        `${family.slug} collides with a machine id`,
      ).toBe(false);
    }
  });

  it('has no duplicates', () => {
    expect(new Set(selectableIds).size).toBe(selectableIds.length);
  });

  it('resolves a machine selection to itself and a family to no machine', () => {
    expect(machineForSelection('cpc6128')).toBe('cpc6128');
    expect(machineForSelection('cpc')).toBeUndefined();
    expect(machineForSelection('zxspectrum')).toBe('zxspectrum');
    expect(machineForSelection('zxspectrum-any')).toBeUndefined();
  });

  it('resolves every selection to a reference page', () => {
    for (const id of selectableIds) {
      expect(pageForSelection(id), id).toBeDefined();
    }
    expect(pageForSelection('nonesuch')).toBeUndefined();
  });

  // The links people have already shared use the reference page slugs. Three of
  // the four still mean the family; `zxspectrum` deliberately now means the 48K
  // machine (see machines.ts).
  it.each(['bbc', 'commodore', 'cpc'])(
    'keeps the legacy page slug %s pointing at its family',
    (slug) => {
      expect(families.some((f) => f.slug === slug)).toBe(true);
      expect(machineForSelection(slug)).toBeUndefined();
    },
  );
});
