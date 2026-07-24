import { describe, expect, it } from 'vitest';
import type { ReferenceTableData } from './types';
import { zx81Reference } from './zx81';
import { zx80Reference } from './zx80';
import { zxspectrumReference } from './zxspectrum';
import { bbcReference } from './bbc';
import { commodoreReference } from './commodore';
import { atomReference } from './atom';
import { trs80Reference } from './trs80';
import { cpcReference } from './cpc';

const SETS: [string, ReferenceTableData][] = [
  ['zx81', zx81Reference],
  ['zx80', zx80Reference],
  ['zxspectrum', zxspectrumReference],
  ['bbc', bbcReference],
  ['commodore', commodoreReference],
  ['atom', atomReference],
  ['trs80', trs80Reference],
  ['cpc', cpcReference],
];

describe.each(SETS)('reference data: %s', (_id, data) => {
  it('has a title, machine list and entries', () => {
    expect(data.title).toBeTruthy();
    expect(data.machines.length).toBeGreaterThan(0);
    expect(data.entries.length).toBeGreaterThan(0);
  });

  it('every entry is structurally complete', () => {
    for (const e of data.entries) {
      expect(e.name, 'name').toBeTruthy();
      expect(['command', 'function', 'operator']).toContain(e.kind);
      expect(e.syntax, `syntax for ${e.name}`).toBeTruthy();
      expect(e.description.length, `description for ${e.name}`).toBeGreaterThan(
        0,
      );
    }
  });

  it('has no duplicate names', () => {
    const names = data.entries.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
