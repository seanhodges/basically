import { describe, it, expect } from 'vitest';
import { petMemoryMap } from './memoryMap';
import { BASIC_RAM_BASE, SCREEN_BASE } from './addresses';

describe('petMemoryMap', () => {
  const { addressSpace, regions } = petMemoryMap;

  it('covers a 64K address space', () => {
    expect(addressSpace).toBe(0x10000);
  });

  it('has no user-defined-graphics area', () => {
    expect(petMemoryMap.udgBase).toBeUndefined();
  });

  it('starts the BASIC program area at $0400', () => {
    const program = regions.find((r) => r.kind === 'program');
    expect(program).toBeDefined();
    expect(program!.start).toBe(BASIC_RAM_BASE);
  });

  it('places the screen matrix at $8000', () => {
    const screen = regions.find((r) => r.kind === 'screen');
    expect(screen).toBeDefined();
    expect(screen!.start).toBe(SCREEN_BASE);
  });

  it('collapses the three system leaves under one band', () => {
    const system = regions.filter((r) => r.group === 'System area');
    expect(system.map((r) => r.kind)).toEqual(['system', 'system', 'system']);
    expect(system[0]!.start).toBe(0x0000);
    expect(system[system.length - 1]!.end).toBe(0x03ff);
  });

  it('has an I/O region for the PIA/VIA chips', () => {
    const io = regions.find((r) => r.kind === 'buffer');
    expect(io).toBeDefined();
    expect(io!.start).toBe(0xe800);
    expect(io!.end).toBe(0xefff);
  });

  it('has the BASIC, editor and KERNAL ROM regions', () => {
    const rom = regions.filter((r) => r.kind === 'rom');
    expect(rom.map((r) => r.start)).toEqual([0xb000, 0xe000, 0xf000]);
  });
});
