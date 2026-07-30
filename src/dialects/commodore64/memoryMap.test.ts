import { describe, it, expect } from 'vitest';
import { c64MemoryMap } from './memoryMap';
import { BASIC_RAM_BASE, SCREEN_BASE } from './addresses';

describe('c64MemoryMap', () => {
  const { addressSpace, regions } = c64MemoryMap;

  it('covers a 64K address space', () => {
    expect(addressSpace).toBe(0x10000);
  });

  it('has no user-defined-graphics area', () => {
    expect(c64MemoryMap.udgBase).toBeUndefined();
  });

  it('starts the BASIC program area at $0800', () => {
    const program = regions.find((r) => r.kind === 'program');
    expect(program).toBeDefined();
    expect(program!.start).toBe(BASIC_RAM_BASE);
  });

  it('places the default video matrix at the screen base', () => {
    const screen = regions.find((r) => r.kind === 'screen');
    expect(screen!.start).toBe(SCREEN_BASE);
  });

  it('collapses the three system leaves under one band', () => {
    const system = regions.filter((r) => r.group === 'System area');
    expect(system.map((r) => r.kind)).toEqual(['system', 'system', 'system']);
    expect(system[0]!.start).toBe(0x0000);
    expect(system[system.length - 1]!.end).toBe(0x03ff);
  });

  it('collapses the I/O leaves under one band spanning $D000-$DFFF', () => {
    const io = regions.filter((r) => r.group === 'I/O area');
    expect(io.length).toBeGreaterThan(1);
    expect(io[0]!.start).toBe(0xd000);
    expect(io[io.length - 1]!.end).toBe(0xdfff);
    // Colour RAM carries the attribute colour within the I/O group.
    expect(io.some((r) => r.kind === 'attributes')).toBe(true);
  });

  it('has two ROM regions (BASIC and KERNAL)', () => {
    const rom = regions.filter((r) => r.kind === 'rom');
    expect(rom.map((r) => r.start)).toEqual([0xa000, 0xe000]);
  });
});
