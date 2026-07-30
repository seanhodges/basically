import { describe, it, expect } from 'vitest';
import { memoryBands } from './memoryBands';
import type { MemoryMap } from '../dialects/types';

const map: MemoryMap = {
  addressSpace: 0x100,
  regions: [
    { start: 0x00, end: 0x0f, label: 'ROM', kind: 'rom' },
    {
      start: 0x10,
      end: 0x1f,
      label: 'Bitmap',
      kind: 'screen',
      group: 'Screen',
    },
    {
      start: 0x20,
      end: 0x2f,
      label: 'Attributes',
      kind: 'attributes',
      group: 'Screen',
    },
    { start: 0x30, end: 0xff, label: 'RAM', kind: 'program' },
  ],
};

describe('memoryBands', () => {
  it('collapses contiguous leaves sharing a group when not detailed', () => {
    const bands = memoryBands(map, false);
    expect(bands.map((b) => b.label)).toEqual(['ROM', 'Screen', 'RAM']);
    const screen = bands.find((b) => b.label === 'Screen')!;
    expect(screen.start).toBe(0x10);
    expect(screen.end).toBe(0x2f);
    expect(screen.leaves).toHaveLength(2);
  });

  it('expands every leaf into its own band when detailed', () => {
    const bands = memoryBands(map, true);
    expect(bands.map((b) => b.label)).toEqual([
      'ROM',
      'Bitmap',
      'Attributes',
      'RAM',
    ]);
    expect(bands.every((b) => b.leaves.length === 1)).toBe(true);
  });

  it('shades a group’s sub-regions in order when detailed', () => {
    // The shade drives how strongly the kind's hue is mixed, so siblings read as
    // one family; ungrouped regions always sit at the base strength.
    const bands = memoryBands(map, true);
    expect(bands.map((b) => [b.label, b.group, b.shade])).toEqual([
      ['ROM', undefined, 0],
      ['Bitmap', 'Screen', 0],
      ['Attributes', 'Screen', 1],
      ['RAM', undefined, 0],
    ]);
  });

  it('leaves collapsed bands unshaded', () => {
    // Zoomed out a band *is* the group, so there is nothing to distinguish it
    // from - every band draws at the base strength.
    const bands = memoryBands(map, false);
    expect(bands.every((b) => b.shade === 0)).toBe(true);
    expect(bands.every((b) => b.group === undefined)).toBe(true);
  });

  it('restarts the ramp when a group appears in a second run', () => {
    // The BBC machines split their ROM group around the memory-mapped I/O
    // window. Each run has to shade from the start, or the second run would be
    // drawn darker than the first for no reason the user could see.
    const split: MemoryMap = {
      addressSpace: 0x100,
      regions: [
        { start: 0x00, end: 0x3f, label: 'Paged ROM', kind: 'rom', group: 'R' },
        { start: 0x40, end: 0x7f, label: 'OS ROM', kind: 'rom', group: 'R' },
        { start: 0x80, end: 0xbf, label: 'I/O', kind: 'buffer' },
        { start: 0xc0, end: 0xff, label: 'Vectors', kind: 'rom', group: 'R' },
      ],
    };
    expect(memoryBands(split, true).map((b) => b.shade)).toEqual([0, 1, 0, 0]);
  });
});
