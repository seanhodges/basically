import { describe, it, expect } from 'vitest';
import { zx80MemoryMap } from './memoryMap';
import { PROGRAM_BASE } from './sysvars';

describe('zx80MemoryMap', () => {
  const { addressSpace, regions } = zx80MemoryMap;

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

  it('starts the BASIC program area at PROGRAM_BASE', () => {
    const program = regions.find((r) => r.kind === 'program');
    expect(program).toBeDefined();
    expect(program!.start).toBe(PROGRAM_BASE);
  });

  it('uses the smaller 4K ROM window before RAM begins', () => {
    const rom = regions.filter((r) => r.kind === 'rom');
    expect(rom[0]!.start).toBe(0);
    // ROM + its mirrors run right up to the start of RAM at 0x4000.
    expect(rom[rom.length - 1]!.end).toBe(0x3fff);
  });

  it('marks the upper 32K as the reserved echo region', () => {
    const echo = regions[regions.length - 1]!;
    expect(echo.start).toBe(0x8000);
    expect(echo.kind).toBe('reserved');
  });
});
