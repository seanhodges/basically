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
import { machines } from './machines';

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

describe('selection namespace', () => {
  // Only machine ids are selectable. A docs page slug is not, because
  // `zxspectrum` is both the 48K machine's id and the page its 128K sibling
  // shares - one string with two meanings in one namespace, which no URL can
  // disambiguate. Keeping pages out of the namespace is what removes the case.
  it('has no duplicate ids', () => {
    const ids = machines.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has a page slug that is not a machine id, and does not offer it', () => {
    const ids = new Set(machines.map((m) => m.id));
    const pageOnly = [...new Set(machines.map((m) => m.page))].filter(
      (page) => !ids.has(page),
    );
    // If this is ever empty the clash risk is gone, but so is the reason for
    // the rule - so assert the shape that makes the rule necessary.
    expect(pageOnly.length).toBeGreaterThan(0);
    for (const page of pageOnly) {
      expect(ids, `${page} is a page, not a selection`).not.toContain(page);
    }
  });

  it('covers a machine whose id is also its page, and one where it is not', () => {
    expect(machines.find((m) => m.id === 'zxspectrum')?.page).toBe(
      'zxspectrum',
    );
    expect(machines.find((m) => m.id === 'zxspectrum128')?.page).toBe(
      'zxspectrum',
    );
  });
});
