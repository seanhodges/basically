import { describe, it, expect } from 'vitest';
import { bbcMicroMemoryMap } from './memoryMap';
import { PAGE_DFS } from './addresses';
import { SCREEN_MODE7_BASE, RAM_TOP } from '../../emulator/bbc/addresses';

describe('bbcMicroMemoryMap', () => {
  const { addressSpace, regions } = bbcMicroMemoryMap;

  it('covers a 64K address space', () => {
    expect(addressSpace).toBe(0x10000);
  });

  it('starts the BASIC program area at PAGE (0x1900) with DFS present', () => {
    const program = regions.find((r) => r.kind === 'program');
    expect(program).toBeDefined();
    expect(program!.start).toBe(PAGE_DFS);
  });

  it('marks the MODE 7 screen at 0x7C00', () => {
    const screen = regions.find((r) => r.kind === 'screen');
    expect(screen).toBeDefined();
    expect(screen!.start).toBe(SCREEN_MODE7_BASE);
    expect(screen!.end).toBe(RAM_TOP);
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
