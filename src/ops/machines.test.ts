import { describe, expect, it } from 'vitest';
import { dialects, getDialect } from '../dialects/registry';
import { listMachines, machinesOp } from './machines';
import { pureContext } from './testSupport';

describe('listing the machines', () => {
  it('reports every registered machine once, with its own blurb', () => {
    const summaries = listMachines(pureContext());
    expect(summaries.map((m) => m.id)).toEqual(dialects.map((d) => d.id));
    for (const summary of summaries) {
      expect(summary.description, summary.id).toBe(
        getDialect(summary.id).blurb,
      );
      expect(typeof summary.romPresent, summary.id).toBe('boolean');
    }
  });

  it('asks the context whether each ROM is here rather than the filesystem', () => {
    const asked: string[] = [];
    const summaries = listMachines(
      pureContext({
        roms: {
          present: (d) => {
            asked.push(d.id);
            return d.id === 'zx81';
          },
        },
      }),
    );
    expect(asked).toEqual(dialects.map((d) => d.id));
    expect(summaries.find((m) => m.id === 'zx81')?.romPresent).toBe(true);
    expect(summaries.find((m) => m.id === 'commodore64')?.romPresent).toBe(
      false,
    );
  });

  it('tells a model which machines lack a ROM', () => {
    const text = machinesOp.describe(
      listMachines(pureContext({ roms: { present: (d) => d.id !== 'zx81' } })),
    );
    expect(text).toMatch(/^zx81: .*\(no ROM here\)$/m);
    expect(text).not.toMatch(/^commodore64: .*\(no ROM here\)$/m);
  });
});
