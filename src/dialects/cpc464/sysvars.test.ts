import { describe, expect, it } from 'vitest';
import { locoSysVars, type LocoSysVars } from './sysvars';

/**
 * The two workspace tables are the one place where a wrong number is silent:
 * a mis-typed address does not throw, it just makes the variable watcher, the
 * runtime report and the debugger read rubbish. These checks pin their shape;
 * the addresses themselves are pinned against the running ROMs by the emulator
 * suites (src/emulator/cpc/cpcBoot.test.ts and cpc6128Boot.test.ts).
 */
const FIELDS: (keyof LocoSysVars)[] = [
  'programStart',
  'progEnd',
  'varStart',
  'arrStart',
  'arrEnd',
  'freeTop',
  'errCode',
  'errLine',
  'curLinePtr',
];

describe('Locomotive BASIC workspace tables', () => {
  const basic10 = locoSysVars('basic10');
  const basic11 = locoSysVars('basic11');

  it('gives both variants a complete table', () => {
    for (const table of [basic10, basic11]) {
      for (const f of FIELDS) {
        expect(Number.isInteger(table[f]), f).toBe(true);
        expect(table[f], f).toBeGreaterThan(0);
        expect(table[f], f).toBeLessThan(0x10000);
      }
    }
  });

  it('starts the program area at &0170 on both machines', () => {
    expect(basic10.programStart).toBe(0x0170);
    expect(basic11.programStart).toBe(0x0170);
  });

  it('keeps the four injection pointers in ascending pairs', () => {
    // loadProgram writes progEnd/varStart/arrStart/arrEnd as consecutive words.
    for (const t of [basic10, basic11]) {
      expect(t.varStart).toBe(t.progEnd + 2);
      expect(t.arrStart).toBe(t.varStart + 2);
      expect(t.arrEnd).toBe(t.arrStart + 2);
    }
  });

  it('puts BASIC 1.1 below 1.0, by a different amount per pointer', () => {
    // Discovered by measurement, and recorded because it is the trap: the
    // workspace did not simply slide, so no 1.1 address may be derived from a
    // 1.0 one. If these ever become equal, someone has done exactly that.
    const deltas = FIELDS.filter((f) => f !== 'programStart').map(
      (f) => basic10[f] - basic11[f],
    );
    for (const d of deltas) expect(d).toBeGreaterThan(0);
    expect(new Set(deltas).size).toBeGreaterThan(1);
  });

  it('shares no address between the two variants', () => {
    const shared = FIELDS.filter(
      (f) => f !== 'programStart' && basic10[f] === basic11[f],
    );
    expect(shared).toEqual([]);
  });
});
