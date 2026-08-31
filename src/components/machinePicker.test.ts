import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MACHINE_SORT,
  MACHINE_SORTS,
  filterMachines,
  groupMachines,
  groupMachinesByManufacturer,
  machineChoiceLabel,
  machineSummary,
  queryHidesMachine,
  machineTriggerLabel,
  targetMachineLabel,
  type MachineLike,
  type MachineSort,
} from './machinePicker';
import { dialects, getDialect } from '../dialects/registry';

// The picker asks a machine for six fields, and both surfaces that render it
// supply them from their own list: the IDE from the registry, the porting guide
// from `src/reference/machines.ts`. The registry-driven cases below pass
// dialects *as* `MachineLike`, which is the structural claim the docs rely on.
const machines: readonly MachineLike[] = dialects;
const c64: MachineLike = getDialect('commodore64');

const ARRANGEMENTS = MACHINE_SORTS.map((s) => s.id);

/** Every machine a grouping returned, in the order it would be read in. */
function listed(sort: MachineSort): string[] {
  return groupMachines(machines, sort).flatMap((g) =>
    g.machines.map((m) => m.id),
  );
}

describe('arranging machines for the picker', () => {
  it('offers manufacturer as the arrangement nobody has to choose', () => {
    expect(DEFAULT_MACHINE_SORT).toBe('manufacturer');
    expect(ARRANGEMENTS).toContain(DEFAULT_MACHINE_SORT);
  });

  it('covers every registered machine exactly once, in every arrangement', () => {
    const all = machines.map((d) => d.id).sort();
    for (const sort of ARRANGEMENTS) {
      expect(listed(sort).sort(), `${sort} should list every machine`).toEqual(
        all,
      );
    }
  });

  it('heads no group it has no machines for, in any arrangement', () => {
    for (const sort of ARRANGEMENTS) {
      for (const group of groupMachines(machines, sort)) {
        expect(
          group.machines.length,
          `${sort} left an empty "${group.heading}"`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('orders rows by name in every arrangement but year', () => {
    for (const sort of ARRANGEMENTS) {
      if (sort === 'year') continue;
      for (const group of groupMachines(machines, sort)) {
        const names = group.machines.map((m) => m.name);
        expect(
          names,
          `${sort} / ${group.heading} should read alphabetically`,
        ).toEqual(
          [...names].sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true }),
          ),
        );
      }
    }
  });

  it('reads a model number as a number, not as digits', () => {
    // The reason a collator is used rather than localeCompare: a plain string
    // compare reaches the second digit of 6128 before it knows it is a number,
    // and puts the 6128 before the 664.
    const cpcs = groupMachines(
      machines.filter((m) => m.manufacturer === 'Amstrad'),
      'model',
    );
    expect(cpcs[0]!.machines.map((m) => m.name)).toEqual([
      'CPC 464',
      'CPC 664',
      'CPC 6128',
    ]);
  });

  describe('by manufacturer', () => {
    const groups = groupMachinesByManufacturer(machines);

    it('orders manufacturers alphabetically', () => {
      const makers = groups.map((g) => g.heading!);
      expect(makers).toEqual([...makers].sort((a, b) => a.localeCompare(b)));
    });

    it('puts every machine under its own manufacturer', () => {
      for (const g of groups) {
        for (const d of g.machines) expect(d.manufacturer).toBe(g.heading);
      }
    });

    it('is what the manufacturer arrangement gives', () => {
      expect(groupMachines(machines, 'manufacturer')).toEqual(groups);
    });
  });

  describe('by model', () => {
    const groups = groupMachines(machines, 'model');

    it('is one ungrouped list', () => {
      expect(groups).toHaveLength(1);
      expect(groups[0]!.heading).toBeNull();
    });

    it('has no group at all when nothing matched', () => {
      expect(groupMachines([], 'model')).toEqual([]);
    });
  });

  describe('by year', () => {
    const groups = groupMachines(machines, 'year');

    it('heads each distinct release year, oldest at the top', () => {
      const headings = groups.map((g) => g.heading!);
      const years = [...new Set(machines.map((m) => m.year))].sort(
        (a, b) => a - b,
      );
      expect(headings).toEqual(years.map(String));
    });

    it('puts every machine under its own year', () => {
      for (const g of groups) {
        for (const m of g.machines) expect(String(m.year)).toBe(g.heading);
      }
    });
  });

  describe('by BASIC dialect', () => {
    const groups = groupMachines(machines, 'basic');

    it('heads the BASICs alphabetically', () => {
      const headings = groups.map((g) => g.heading!);
      expect(headings).toEqual(
        [...headings].sort((a, b) => a.localeCompare(b)),
      );
    });

    it('puts every machine under the BASIC it declares', () => {
      for (const g of groups) {
        for (const m of g.machines) expect(m.basicDialect).toBe(g.heading);
      }
    });

    it('groups the machines that share a BASIC', () => {
      // Two CPCs run Locomotive BASIC 1.1, and the manufacturer arrangement is
      // the one that cannot show it: this is the arrangement's whole point.
      const shared = groups.find((g) => g.heading === 'Locomotive BASIC 1.1')!;
      expect(shared.machines.map((m) => m.id)).toEqual(['cpc664', 'cpc6128']);
    });
  });
});

describe('narrowing the machine list', () => {
  it('matches everything when nothing has been typed', () => {
    expect(filterMachines(machines, '')).toHaveLength(machines.length);
    expect(filterMachines(machines, '   ')).toHaveLength(machines.length);
  });

  it('matches a machine by name', () => {
    expect(filterMachines(machines, 'spectrum').map((m) => m.id)).toEqual([
      'zxspectrum',
      'zxspectrum128',
    ]);
  });

  it('matches a machine by manufacturer', () => {
    const ids = filterMachines(machines, 'amstrad').map((m) => m.id);
    expect(ids).toEqual(['cpc464', 'cpc664', 'cpc6128']);
  });

  it('matches a machine by the BASIC it runs', () => {
    // "Locomotive" is in no machine's name and no manufacturer, so a hit can
    // only have come from the BASIC.
    const ids = filterMachines(machines, 'locomotive').map((m) => m.id);
    expect(ids).toEqual(['cpc464', 'cpc664', 'cpc6128']);
  });

  it('ignores letter case, and surrounding space', () => {
    expect(filterMachines(machines, '  ApPlEsOfT  ').map((m) => m.id)).toEqual([
      'apple2plus',
    ]);
  });

  it('matches nothing when nothing matches', () => {
    expect(filterMachines(machines, 'dragon 32')).toEqual([]);
  });

  it('leaves the arrangement with no empty headings', () => {
    for (const sort of ARRANGEMENTS) {
      const groups = groupMachines(filterMachines(machines, 'sinclair'), sort);
      for (const g of groups) expect(g.machines.length).toBeGreaterThan(0);
      expect(groups.flatMap((g) => g.machines).length).toBeGreaterThan(0);
    }
  });
});

describe('a remembered search that hides the machine you are on', () => {
  it('does not report a machine the search matches', () => {
    // The ZX81 is a Sinclair, so this search is one the list may keep.
    expect(queryHidesMachine(machines, 'sinclair', 'zx81')).toBe(false);
  });

  it('reports a machine the search matches other machines instead of', () => {
    expect(queryHidesMachine(machines, 'locomotive', 'zx81')).toBe(true);
  });

  it('reports it when the search matches nothing at all', () => {
    // Otherwise the list opens on the no-matches state, which is the worst of
    // the cases this rule exists for.
    expect(queryHidesMachine(machines, 'dragon 32', 'zx81')).toBe(true);
  });

  it('reports nothing when there is no search', () => {
    expect(queryHidesMachine(machines, '', 'zx81')).toBe(false);
    expect(queryHidesMachine(machines, '  ', 'zx81')).toBe(false);
  });

  it('reports nothing for a machine the list is not offering', () => {
    // The picker hides a machine whose ROM is absent. Clearing the search would
    // not bring it back, so a good search must not be thrown away for it.
    const offered = machines.filter((m) => m.id !== 'bbcmicro');
    expect(queryHidesMachine(offered, 'sinclair', 'bbcmicro')).toBe(false);
  });

  it('agrees with the filter it is asked about', () => {
    // The rule must not restate the match: every machine the filter drops is
    // hidden, and every machine it keeps is not.
    const query = 'commodore';
    const kept = new Set(filterMachines(machines, query).map((m) => m.id));
    for (const m of machines) {
      expect(
        queryHidesMachine(machines, query, m.id),
        `${m.id} should ${kept.has(m.id) ? 'not ' : ''}be hidden by "${query}"`,
      ).toBe(!kept.has(m.id));
    }
  });
});

describe('picker labels', () => {
  it('summarises a machine by maker and year', () => {
    expect(machineSummary(c64)).toBe('Commodore 1982');
  });

  it('names the machine in the trigger label, since it can be icon-only', () => {
    expect(targetMachineLabel(c64)).toContain('C64');
    expect(targetMachineLabel(c64)).toMatch(/target machine/i);
  });

  it('disambiguates rows whose names prefix one another', () => {
    const spectrum: MachineLike = getDialect('zxspectrum');
    const spectrum128: MachineLike = getDialect('zxspectrum128');
    expect(machineChoiceLabel(spectrum)).not.toBe(
      machineChoiceLabel(spectrum128),
    );
    expect(machineChoiceLabel(spectrum)).toContain('1982');
  });

  it('gives every registered machine a distinct row label', () => {
    const labels = machines.map(machineChoiceLabel);
    expect(new Set(labels).size).toBe(machines.length);
  });

  it('lets the caller name the part the machine plays', () => {
    // The IDE's phrasing is one caller's, not the component's: in the porting
    // guide one of the two triggers is the machine being ported *from*.
    expect(machineTriggerLabel('Porting from', c64)).toBe('Porting from: C64');
    expect(targetMachineLabel(c64)).toBe('Target machine: C64');
  });
});
