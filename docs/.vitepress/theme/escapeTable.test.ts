import { describe, expect, it } from 'vitest';
import type { EscapeEntry } from '../../../src/reference/types';
import { filterEscapes, sortEscapes } from './escapeTable';

const entry = (over: Partial<EscapeEntry>): EscapeEntry => ({
  escape: '{X}',
  bytes: '0x00',
  category: 'control',
  description: '',
  example: { source: '{X}', bytes: [0x00] },
  ...over,
});

const ENTRIES: EscapeEntry[] = [
  entry({
    escape: '{clr}',
    bytes: '0x93',
    category: 'control',
    description: 'Clear the screen',
    example: { source: '{clr}', bytes: [0x93] },
  }),
  entry({
    escape: '{white}',
    bytes: '0x05',
    category: 'colour',
    description: 'Text colour white',
    aliases: ['{wht}'],
    example: { source: '{white}', bytes: [0x05] },
  }),
  entry({
    escape: '{$xx}',
    bytes: '0x60–0x7F',
    category: 'raw',
    description: 'Any raw byte',
    example: { source: '{$60}', bytes: [0x60] },
  }),
];

describe('filterEscapes', () => {
  it('matches the escape spelling case-insensitively', () => {
    expect(filterEscapes(ENTRIES, 'CLR', 'all')).toHaveLength(1);
  });

  it('matches descriptions and aliases', () => {
    expect(filterEscapes(ENTRIES, 'screen', 'all')[0]!.escape).toBe('{clr}');
    expect(filterEscapes(ENTRIES, '{wht}', 'all')[0]!.escape).toBe('{white}');
  });

  it('matches byte values with or without a 0x/$ prefix', () => {
    for (const q of ['0x93', '$93', '93']) {
      expect(filterEscapes(ENTRIES, q, 'all')[0]!.escape).toBe('{clr}');
    }
  });

  it('applies the category filter, alone and with a query', () => {
    expect(filterEscapes(ENTRIES, '', 'colour')).toHaveLength(1);
    expect(filterEscapes(ENTRIES, 'white', 'raw')).toHaveLength(0);
  });

  it('returns everything for an empty query on all', () => {
    expect(filterEscapes(ENTRIES, '', 'all')).toHaveLength(3);
  });
});

describe('sortEscapes', () => {
  it('sorts by first example byte ascending by default', () => {
    const sorted = sortEscapes(ENTRIES, 'bytes', 'asc');
    expect(sorted.map((e) => e.escape)).toEqual(['{white}', '{$xx}', '{clr}']);
  });

  it('sorts by escape spelling and respects direction', () => {
    const sorted = sortEscapes(ENTRIES, 'escape', 'desc');
    expect(sorted[0]!.escape).toBe('{white}');
  });

  it('does not mutate the input', () => {
    const copy = [...ENTRIES];
    sortEscapes(ENTRIES, 'bytes', 'desc');
    expect(ENTRIES).toEqual(copy);
  });
});
