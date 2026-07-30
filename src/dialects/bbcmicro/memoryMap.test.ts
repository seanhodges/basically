import { describe, it, expect } from 'vitest';
import { bbcMicroMemoryMap } from './memoryMap';

describe('bbcMicroMemoryMap', () => {
  const { addressSpace, regions } = bbcMicroMemoryMap;

  it('covers a 64K address space', () => {
    expect(addressSpace).toBe(0x10000);
  });

  it('starts the BASIC program area at PAGE (0x1900) with DFS present', () => {
    const program = regions.find((r) => r.kind === 'program');
    expect(program).toBeDefined();
    expect(program!.start).toBe(0x1900);
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
    expect(bbcMicroMemoryMap.udgBase).toBeUndefined();
  });
});
