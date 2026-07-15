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
});
