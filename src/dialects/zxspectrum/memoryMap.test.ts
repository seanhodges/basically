import { describe, it, expect } from 'vitest';
import { spectrumMemoryMap } from './memoryMap';

describe('spectrumMemoryMap', () => {
  const { addressSpace, regions } = spectrumMemoryMap;

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

  it('places the BASIC program area where PROG/RAMTOP defaults sit on a 48K machine', () => {
    const program = regions.find((r) => r.kind === 'program');
    expect(program).toBeDefined();
    expect(program!.start).toBe(0x5ccb);
    expect(program!.end).toBe(0xff57);
  });

  it('groups the screen bitmap and attributes under one collapsed band', () => {
    const screenGroup = regions.filter((r) => r.group === 'Screen memory');
    expect(screenGroup.map((r) => r.kind)).toEqual(['screen', 'attributes']);
  });
});
