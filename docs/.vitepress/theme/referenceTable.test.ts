import { describe, expect, it } from 'vitest';
import type { ReferenceEntry } from '../../reference/data/types';
import { filterEntries, findEntryByName, sortEntries } from './referenceTable';

const ENTRIES: ReferenceEntry[] = [
  {
    name: 'PRINT',
    kind: 'command',
    domain: 'text-screen',
    syntax: 'PRINT [<expr>…]',
    description: 'Write to the screen.',
  },
  {
    name: 'INPUT',
    kind: 'command',
    domain: 'input',
    syntax: 'INPUT [<string>;] <var>',
    description: 'Read from the keyboard.',
  },
  {
    name: 'RND',
    kind: 'function',
    domain: 'numeric',
    syntax: 'RND',
    description: 'Random number.',
  },
  {
    name: 'AND',
    kind: 'operator',
    domain: 'numeric',
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

describe('findEntryByName', () => {
  it('matches an exact name case-insensitively, ignoring surrounding space', () => {
    expect(findEntryByName(ENTRIES, 'print')?.name).toBe('PRINT');
    expect(findEntryByName(ENTRIES, '  RND  ')?.name).toBe('RND');
  });

  it('does not match on a substring - deep links pin one exact row', () => {
    expect(findEntryByName(ENTRIES, 'in')).toBeUndefined();
    expect(findEntryByName(ENTRIES, 'PRIN')).toBeUndefined();
  });

  it('returns undefined for a blank or unknown name', () => {
    expect(findEntryByName(ENTRIES, '')).toBeUndefined();
    expect(findEntryByName(ENTRIES, '   ')).toBeUndefined();
    expect(findEntryByName(ENTRIES, 'GOSUB')).toBeUndefined();
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

describe('filterEntries: capability domain', () => {
  it('keeps only the entries in the chosen domain', () => {
    expect(
      filterEntries(ENTRIES, '', 'all', 'numeric').map((e) => e.name),
    ).toEqual(['RND', 'AND']);
  });

  it('defaults to "all", so the assembly pages need pass nothing', () => {
    expect(filterEntries(ENTRIES, '', 'all')).toHaveLength(4);
    expect(filterEntries(ENTRIES, '', 'all', 'all')).toHaveLength(4);
  });

  // Orthogonal to the other two: narrowing by domain must not widen or reset
  // the kind and query filters, and vice versa.
  it('ANDs with the kind filter', () => {
    expect(
      filterEntries(ENTRIES, '', 'function', 'numeric').map((e) => e.name),
    ).toEqual(['RND']);
    expect(filterEntries(ENTRIES, '', 'command', 'numeric')).toEqual([]);
  });

  it('ANDs with the query', () => {
    expect(
      filterEntries(ENTRIES, 'n', 'all', 'numeric').map((e) => e.name),
    ).toEqual(['RND', 'AND']);
    expect(filterEntries(ENTRIES, 'print', 'all', 'numeric')).toEqual([]);
  });

  it('ANDs all three at once', () => {
    expect(
      filterEntries(ENTRIES, 'a', 'operator', 'numeric').map((e) => e.name),
    ).toEqual(['AND']);
  });

  it('matches nothing when no entry carries the domain', () => {
    expect(filterEntries(ENTRIES, '', 'all', 'sound')).toEqual([]);
  });
});
