import { describe, expect, it } from 'vitest';
import type { EscapeTableData } from '../types';
import { zx81Escapes } from './zx81';
import { zx80Escapes } from './zx80';
import { zxspectrumEscapes } from './zxspectrum';
import { bbcEscapes } from './bbc';
import { commodore64Escapes } from './commodore64';
import { trs80Escapes } from './trs80';
import { atomEscapes } from './atom';
import { cpcEscapes } from './cpc';

const SETS: [string, EscapeTableData][] = [
  ['zx81', zx81Escapes],
  ['zx80', zx80Escapes],
  ['zxspectrum', zxspectrumEscapes],
  ['bbc', bbcEscapes],
  ['commodore64', commodore64Escapes],
  ['trs80', trs80Escapes],
  ['atom', atomEscapes],
  ['cpc', cpcEscapes],
];

describe.each(SETS)('escape data: %s', (_id, data) => {
  it('has a title, machine list, categories and entries', () => {
    expect(data.title).toBeTruthy();
    expect(data.machines.length).toBeGreaterThan(0);
    expect(data.categories.length).toBeGreaterThan(0);
    expect(data.entries.length).toBeGreaterThan(0);
  });

  it('every entry is structurally complete', () => {
    const catIds = new Set(data.categories.map((c) => c.id));
    for (const e of data.entries) {
      expect(e.escape, 'escape').toBeTruthy();
      expect(e.bytes, `bytes for ${e.escape}`).toBeTruthy();
      expect(catIds.has(e.category), `category for ${e.escape}`).toBe(true);
      expect(
        e.description.length,
        `description for ${e.escape}`,
      ).toBeGreaterThan(0);
      expect(e.example.source, `example for ${e.escape}`).toBeTruthy();
      expect(
        e.example.bytes.length,
        `example bytes for ${e.escape}`,
      ).toBeGreaterThan(0);
    }
  });

  it('has no duplicate escape spellings', () => {
    const names = data.entries.map((e) => e.escape);
    expect(new Set(names).size).toBe(names.length);
  });

  it('has at most one catch-all (rest) row', () => {
    const rest = data.entries.filter((e) => e.codes === 'rest');
    expect(rest.length).toBeLessThanOrEqual(1);
  });

  it('every category has at least one entry', () => {
    for (const c of data.categories) {
      expect(
        data.entries.some((e) => e.category === c.id),
        `entries for category ${c.id}`,
      ).toBe(true);
    }
  });
});
