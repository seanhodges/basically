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
      expect(typeof summary.canRun, summary.id).toBe('boolean');
    }
  });

  it('asks the context whether each machine runs here rather than the filesystem', () => {
    const asked: string[] = [];
    const summaries = listMachines(
      pureContext({
        roms: {
          canRun: (d) => {
            asked.push(d.id);
            return d.id === 'zx81';
          },
        },
      }),
    );
    expect(asked).toEqual(dialects.map((d) => d.id));
    expect(summaries.find((m) => m.id === 'zx81')?.canRun).toBe(true);
    expect(summaries.find((m) => m.id === 'commodore64')?.canRun).toBe(false);
  });

  it('tells a model which machines it cannot run here', () => {
    const text = machinesOp.describe(
      listMachines(pureContext({ roms: { canRun: (d) => d.id !== 'zx81' } })),
    );
    expect(text).toMatch(/^zx81: .*\(cannot be run here: no ROM\)$/m);
    expect(text).not.toMatch(/^commodore64: .*\(cannot be run here/m);
  });

  it('asks the probe about the ROM directory the caller named', () => {
    const asked: (string | undefined)[] = [];
    machinesOp.run(
      { romRoot: '/roms/of/my/own' },
      pureContext({
        roms: {
          canRun: (_dialect, romRoot) => {
            asked.push(romRoot);
            return true;
          },
        },
      }),
    );
    // Every machine, against the directory the run will actually read - so what
    // a caller is told it can run is not decided somewhere else.
    expect(asked).toHaveLength(dialects.length);
    expect(new Set(asked)).toEqual(new Set(['/roms/of/my/own']));
  });
});
