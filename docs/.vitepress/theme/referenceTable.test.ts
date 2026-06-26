import { describe, expect, it } from 'vitest';
import type { ReferenceEntry } from '../../reference/data/types';
import { filterEntries, sortEntries } from './referenceTable';

const ENTRIES: ReferenceEntry[] = [
  {
    name: 'PRINT',
    kind: 'command',
    syntax: 'PRINT [<expr>…]',
    description: 'Write to the screen.',
  },
  {
    name: 'INPUT',
    kind: 'command',
    syntax: 'INPUT [<string>;] <var>',
    description: 'Read from the keyboard.',
  },
  {
    name: 'RND',
    kind: 'function',
    syntax: 'RND',
    description: 'Random number.',
  },
  {
    name: 'AND',
    kind: 'operator',
    syntax: '<number> AND <number>',
    description: 'Bitwise AND.',
  },
];

describe('filterEntries', () => {
  it('returns everything when query is empty and kind is "all"', () => {
    expect(filterEntries(ENTRIES, '', 'all')).toHaveLength(4);
  });

  it('matches the name only, case-insensitively', () => {
    expect(filterEntries(ENTRIES, 'rnd', 'all').map((e) => e.name)).toEqual([
      'RND',
    ]);
    expect(filterEntries(ENTRIES, 'in', 'all').map((e) => e.name)).toEqual([
      'PRINT',
      'INPUT',
    ]);
    // Syntax and description are no longer searched.
    expect(filterEntries(ENTRIES, 'keyboard', 'all')).toEqual([]);
    expect(filterEntries(ENTRIES, '<string>', 'all')).toEqual([]);
  });

  it('filters by kind', () => {
    expect(filterEntries(ENTRIES, '', 'function').map((e) => e.name)).toEqual([
      'RND',
    ]);
    expect(filterEntries(ENTRIES, '', 'operator').map((e) => e.name)).toEqual([
      'AND',
    ]);
  });

  it('combines query and kind', () => {
    expect(filterEntries(ENTRIES, 'p', 'command').map((e) => e.name)).toEqual([
      'PRINT',
      'INPUT',
    ]);
  });
});

describe('sortEntries', () => {
  it('sorts by name ascending and descending without mutating the input', () => {
    const asc = sortEntries(ENTRIES, 'name', 'asc').map((e) => e.name);
    expect(asc).toEqual(['AND', 'INPUT', 'PRINT', 'RND']);
    const desc = sortEntries(ENTRIES, 'name', 'desc').map((e) => e.name);
    expect(desc).toEqual(['RND', 'PRINT', 'INPUT', 'AND']);
    expect(ENTRIES[0].name).toBe('PRINT'); // original order untouched
  });

  it('sorts by kind, breaking ties by name', () => {
    const byKind = sortEntries(ENTRIES, 'kind', 'asc').map(
      (e) => `${e.kind}:${e.name}`,
    );
    expect(byKind).toEqual([
      'command:INPUT',
      'command:PRINT',
      'function:RND',
      'operator:AND',
    ]);
  });
});
