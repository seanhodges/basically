import { describe, it, expect } from 'vitest';
import { atomMemoryMap } from './memoryMap';
import { TEXT_START, VIDEO_BASE } from './addresses';

describe('atomMemoryMap', () => {
  const { addressSpace, regions } = atomMemoryMap;

  it('covers a 64K address space', () => {
    expect(addressSpace).toBe(0x10000);
  });

  it('starts the BASIC program area at TEXT_START (0x2900)', () => {
    const program = regions.find((r) => r.kind === 'program');
    expect(program).toBeDefined();
    expect(program!.start).toBe(TEXT_START);
  });

  it('marks the VDG video RAM from 0x8000', () => {
    const screen = regions.find((r) => r.kind === 'screen');
    expect(screen).toBeDefined();
    expect(screen!.start).toBe(VIDEO_BASE);
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
