/**
 * Pins the comparison's machine list to the dialect registry, so the porting
 * guide cannot fall behind the IDE.
 *
 * The docs runtime may never reach the registry - it pulls in every emulator
 * core - so `machines.ts` restates what the registry knows. This file is what
 * makes that restatement safe: a newly registered dialect, a renamed machine, a
 * changed `docsReference` or a reworded blurb fails here until `machines.ts`
 * agrees.
 *
 * The manufacturer, year and blurb are pinned for the same reason the name is:
 * the guide renders the IDE's own machine picker, which shows all three. They
 * replace a `makerOf` map that `compare.md` inlined with nothing pinning it, so
 * a machine missing a manufacturer used to group silently under its own name.
 *
 * Like the sibling crosschecks it imports `src/` freely: vitest runs it in node
 * and the VitePress bundle never includes *.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { dialects } from '../../../src/dialects/registry';
import {
  groupMachinesByManufacturer,
  type MachineLike,
} from '../../../src/components/machinePicker';
import { machines } from './machines';

const registryIds = dialects.map((d) => d.id).sort();

describe('machine list', () => {
  it('offers every registered dialect, and only those', () => {
    expect(machines.map((m) => m.id).sort()).toEqual(registryIds);
  });

  it.each(dialects.map((d) => [d.id, d] as const))(
    '%s carries the dialect name, docs page and picker facts',
    (id, dialect) => {
      const choice = machines.find((m) => m.id === id);
      expect(choice).toBeDefined();
      expect(choice!.name).toBe(dialect.name);
      expect(choice!.page).toBe(dialect.docsReference ?? dialect.id);
      expect(choice!.manufacturer).toBe(dialect.manufacturer);
      expect(choice!.year).toBe(dialect.year);
      expect(choice!.blurb).toBe(dialect.blurb);
    },
  );
});

describe('what the picker asks of a machine', () => {
  // `MachineChoice` has to satisfy `MachineLike` for the guide to render the
  // IDE's picker at all. The check is a type assignment rather than an
  // assertion: it fails at `tsc`, where the mistake is made.
  it('supplies every field the shared picker reads', () => {
    const asMachines: readonly MachineLike[] = machines;
    expect(asMachines).toHaveLength(machines.length);
    // And the picker's own grouping agrees with the registry, so the list the
    // guide shows is ordered exactly as the IDE's is.
    for (const group of groupMachinesByManufacturer(asMachines)) {
      for (const machine of group.machines) {
        expect(machine.manufacturer).toBe(group.manufacturer);
      }
    }
  });
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
