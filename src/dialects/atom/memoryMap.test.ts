import { describe, it, expect } from 'vitest';
import { atomMemoryMap } from './memoryMap';

describe('atomMemoryMap', () => {
  const { addressSpace, regions } = atomMemoryMap;

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

  it('starts the BASIC program area at TEXT_START (0x2900)', () => {
    const program = regions.find((r) => r.kind === 'program');
    expect(program).toBeDefined();
    expect(program!.start).toBe(0x2900);
  });

  it('marks the VDG video RAM from 0x8000', () => {
    const screen = regions.find((r) => r.kind === 'screen');
    expect(screen).toBeDefined();
    expect(screen!.start).toBe(0x8000);
    expect(screen!.end).toBe(0x9fff);
  });

  it('groups the ROM leaves under one band', () => {
    const rom = regions.filter((r) => r.group === 'ROM');
    expect(rom.length).toBeGreaterThan(1);
    expect(rom.every((r) => r.kind === 'rom')).toBe(true);
  });

  it('has no udgBase (Atom BASIC has no USR-letter UDG area)', () => {
    expect(atomMemoryMap.udgBase).toBeUndefined();
  });
});
