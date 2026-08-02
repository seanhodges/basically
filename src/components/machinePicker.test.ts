import { describe, expect, it } from 'vitest';
import {
  groupMachinesByManufacturer,
  machineChoiceLabel,
  machineSummary,
  machineTriggerLabel,
  targetMachineLabel,
  type MachineLike,
} from './machinePicker';
import { dialects, getDialect } from '../dialects/registry';

// The picker asks a machine for five fields, and both surfaces that render it
// supply them from their own list: the IDE from the registry, the porting guide
// from `src/reference/machines.ts`. The registry-driven cases below pass
// dialects *as* `MachineLike`, which is the structural claim the docs rely on.
const machines: readonly MachineLike[] = dialects;
const c64: MachineLike = getDialect('commodore64');

describe('grouping machines for the picker', () => {
  const groups = groupMachinesByManufacturer(machines);

  it('covers every registered machine exactly once', () => {
    const grouped = groups.flatMap((g) => g.machines.map((d) => d.id));
    expect(grouped.sort()).toEqual(machines.map((d) => d.id).sort());
  });

  it('orders manufacturers alphabetically', () => {
    const makers = groups.map((g) => g.manufacturer);
    expect(makers).toEqual([...makers].sort((a, b) => a.localeCompare(b)));
  });

  it('orders each manufacturer machines oldest first', () => {
    for (const g of groups) {
      const years = g.machines.map((d) => d.year);
      expect(years, `${g.manufacturer} should be oldest first`).toEqual(
        [...years].sort((a, b) => a - b),
      );
    }
  });

  it('puts every machine under its own manufacturer', () => {
    for (const g of groups) {
      for (const d of g.machines) expect(d.manufacturer).toBe(g.manufacturer);
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
