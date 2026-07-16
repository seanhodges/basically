import { describe, it, expect } from 'vitest';
import { spectrum128MemoryMap } from './memoryMap';

describe('spectrum128MemoryMap', () => {
  const { addressSpace, regions, udgBase } = spectrum128MemoryMap;

  it('covers a 64K address space', () => {
    expect(addressSpace).toBe(0x10000);
  });

  it('has contiguous, ascending regions covering the whole space with no gaps or overlaps', () => {
    expect(regions.length).toBeGreaterThan(0);
    expect(regions[0]!.start).toBe(0);
    expect(regions[regions.length - 1]!.end).toBe(addressSpace - 1);
    for (let i = 0; i < regions.length; i++) {
      const r = regions[i]!;
      expect(r.end).toBeGreaterThanOrEqual(r.start);
      if (i > 0) {
        // Each region begins exactly one byte after the previous one ends.
        expect(r.start).toBe(regions[i - 1]!.end + 1);
      }
    }
  });

  it('keeps the 48K UDG base so POKE USR "a" resolves', () => {
    expect(udgBase).toBe(0xff58);
  });

  it('places the paged RAM window at the top 16K', () => {
    const paged = regions[regions.length - 1]!;
    expect(paged.start).toBe(0xc000);
    expect(paged.end).toBe(0xffff);
    expect(paged.kind).toBe('program');
  });

  it('groups the screen bitmap and attributes under one collapsed band', () => {
    const screenGroup = regions.filter((r) => r.group === 'Screen memory');
    expect(screenGroup.map((r) => r.kind)).toEqual(['screen', 'attributes']);
  });

  it('collapses the three RAM spans above the system area into one band', () => {
    const avail = regions.filter((r) => r.group === 'Available memory');
    expect(avail.length).toBe(3);
    expect(avail.every((r) => r.kind === 'program')).toBe(true);
  });
});
