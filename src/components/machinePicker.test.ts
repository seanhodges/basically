import { describe, expect, it } from 'vitest';
import {
  groupMachinesByManufacturer,
  machineChoiceLabel,
  machineSummary,
  targetMachineLabel,
} from './machinePicker';
import { dialects, getDialect } from '../dialects/registry';

const c64 = getDialect('commodore64');

describe('grouping machines for the picker', () => {
  const groups = groupMachinesByManufacturer(dialects);

  it('covers every registered machine exactly once', () => {
    const grouped = groups.flatMap((g) => g.machines.map((d) => d.id));
    expect(grouped.sort()).toEqual(dialects.map((d) => d.id).sort());
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
    const spectrum = getDialect('zxspectrum');
    const spectrum128 = getDialect('zxspectrum128');
    expect(machineChoiceLabel(spectrum)).not.toBe(
      machineChoiceLabel(spectrum128),
    );
    expect(machineChoiceLabel(spectrum)).toContain('1982');
  });

  it('gives every registered machine a distinct row label', () => {
    const labels = dialects.map(machineChoiceLabel);
    expect(new Set(labels).size).toBe(dialects.length);
  });
});
