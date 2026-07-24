import { describe, expect, it } from 'vitest';
import type {
  EscapeTableData,
  ReferenceEntry,
  ReferenceTableData,
} from '../../reference/data/types';
import { diffEscapes, diffKeywords } from './dialectCompare';

/** Build a minimal reference table from bare entries (title/machines unused by the diff). */
function refTable(entries: ReferenceEntry[]): ReferenceTableData {
  return { title: 't', machines: ['m'], entries };
}

const PRINT: ReferenceEntry = {
  name: 'PRINT',
  kind: 'command',
  syntax: 'PRINT [<expr>]',
  description: 'Write to the screen.',
};
const LET: ReferenceEntry = {
  name: 'LET',
  kind: 'command',
  syntax: 'LET <var>=<expr>',
  description: 'Assign a variable.',
};
const PROC: ReferenceEntry = {
  name: 'PROC',
  kind: 'command',
  syntax: 'PROC<name>',
  description: 'Call a procedure.',
};

describe('diffKeywords', () => {
  it('buckets source-only names into mustReplace', () => {
    const diff = diffKeywords(refTable([PRINT, LET]), refTable([PRINT]));
    expect(diff.mustReplace.map((e) => e.name)).toEqual(['LET']);
    expect(diff.newlyAvailable).toEqual([]);
    expect(diff.unchanged).toBe(1);
  });

  it('buckets target-only names into newlyAvailable', () => {
    const diff = diffKeywords(refTable([PRINT]), refTable([PRINT, PROC]));
    expect(diff.newlyAvailable.map((e) => e.name)).toEqual(['PROC']);
    expect(diff.mustReplace).toEqual([]);
  });

  it('flags a differing kind as a behaviour change', () => {
    const asOperator: ReferenceEntry = { ...PRINT, kind: 'operator' };
    const diff = diffKeywords(refTable([PRINT]), refTable([asOperator]));
    expect(diff.behaviourChanged).toHaveLength(1);
    expect(diff.behaviourChanged[0]!.from.kind).toBe('command');
    expect(diff.behaviourChanged[0]!.to.kind).toBe('operator');
    expect(diff.unchanged).toBe(0);
  });

  it('flags a differing syntax as a behaviour change', () => {
    const wider: ReferenceEntry = { ...PRINT, syntax: 'PRINT [<expr>][;|,]' };
    const diff = diffKeywords(refTable([PRINT]), refTable([wider]));
    expect(diff.behaviourChanged).toHaveLength(1);
  });

  it('ignores whitespace-only syntax differences', () => {
    const respaced: ReferenceEntry = { ...PRINT, syntax: 'PRINT   [<expr>]' };
    const diff = diffKeywords(refTable([PRINT]), refTable([respaced]));
    expect(diff.behaviourChanged).toEqual([]);
    expect(diff.unchanged).toBe(1);
  });

  it('ignores description differences', () => {
    const reworded: ReferenceEntry = {
      ...PRINT,
      description: 'Different prose.',
    };
    const diff = diffKeywords(refTable([PRINT]), refTable([reworded]));
    expect(diff.behaviourChanged).toEqual([]);
    expect(diff.unchanged).toBe(1);
  });

  it('returns empty buckets for a self-compare', () => {
    const table = refTable([PRINT, LET, PROC]);
    const diff = diffKeywords(table, table);
    expect(diff.mustReplace).toEqual([]);
    expect(diff.newlyAvailable).toEqual([]);
    expect(diff.behaviourChanged).toEqual([]);
    expect(diff.unchanged).toBe(3);
  });

  it('sorts each bucket by name', () => {
    const diff = diffKeywords(
      refTable([PROC, LET, PRINT]),
      refTable([{ ...PRINT }]),
    );
    // LET and PROC are source-only; PRINT is unchanged.
    expect(diff.mustReplace.map((e) => e.name)).toEqual(['LET', 'PROC']);
  });
});

/** Build a minimal escape table from bare entries. */
function escTable(entries: EscapeTableData['entries']): EscapeTableData {
  return { title: 't', machines: ['m'], categories: [], entries };
}

const INK: EscapeTableData['entries'][number] = {
  escape: '{INK n}',
  bytes: '0x10 n',
  category: 'colour',
  description: 'Set ink colour.',
  example: { source: '{INK 2}', bytes: [0x10, 2] },
};
const BLOCK: EscapeTableData['entries'][number] = {
  escape: '▘',
  bytes: '0x01',
  category: 'graphics',
  description: 'Top-left block.',
  example: { source: '▘', bytes: [0x01] },
};

describe('diffEscapes', () => {
  it('buckets source-only, target-only and changed escapes', () => {
    const changedBlock = { ...BLOCK, bytes: '0x81' };
    const diff = diffEscapes(escTable([INK, BLOCK]), escTable([changedBlock]));
    expect(diff.mustReplace.map((e) => e.escape)).toEqual(['{INK n}']);
    expect(diff.behaviourChanged.map((c) => c.escape)).toEqual(['▘']);
    expect(diff.newlyAvailable).toEqual([]);
  });

  it('treats a differing category as a change', () => {
    const recat = { ...INK, category: 'control' };
    const diff = diffEscapes(escTable([INK]), escTable([recat]));
    expect(diff.behaviourChanged).toHaveLength(1);
    expect(diff.unchanged).toBe(0);
  });

  it('counts identical escapes as unchanged', () => {
    const diff = diffEscapes(escTable([INK, BLOCK]), escTable([INK, BLOCK]));
    expect(diff.unchanged).toBe(2);
    expect(diff.mustReplace).toEqual([]);
  });
});
