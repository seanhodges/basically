import { describe, it, expect } from 'vitest';
import { bbcMasterMemoryMap } from './memoryMap';

describe('bbcMasterMemoryMap', () => {
  const { addressSpace, regions } = bbcMasterMemoryMap;

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
        expect(r.start).toBe(regions[i - 1]!.end + 1);
      }
    }
  });

  it('starts the BASIC program area at PAGE (0x0E00) - no DFS PAGE bump on the Master', () => {
    const program = regions.find((r) => r.kind === 'program');
    expect(program).toBeDefined();
    expect(program!.start).toBe(0x0e00);
  });

  it('marks the MODE 7 screen at 0x7C00', () => {
    const screen = regions.find((r) => r.kind === 'screen');
    expect(screen).toBeDefined();
    expect(screen!.start).toBe(0x7c00);
    expect(screen!.end).toBe(0x7fff);
  });

  it('groups the ROM leaves under one band', () => {
    const rom = regions.filter((r) => r.group === 'ROM');
    expect(rom.length).toBeGreaterThan(1);
    expect(rom.every((r) => r.kind === 'rom')).toBe(true);
  });

  it('has no udgBase (BBC BASIC has no USR-letter UDG area)', () => {
    expect(bbcMasterMemoryMap.udgBase).toBeUndefined();
  });
});
