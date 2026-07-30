import { describe, it, expect } from 'vitest';
import { vic20MemoryMap } from './memoryMap';

describe('vic20MemoryMap', () => {
  const { addressSpace, regions } = vic20MemoryMap;

  it('covers a 64K address space', () => {
    expect(addressSpace).toBe(0x10000);
  });

  it('has no user-defined-graphics area', () => {
    expect(vic20MemoryMap.udgBase).toBeUndefined();
  });

  it('starts the BASIC program area at $1000', () => {
    const program = regions.find((r) => r.kind === 'program');
    expect(program).toBeDefined();
    expect(program!.start).toBe(0x1000);
  });

  it('places the screen matrix at $1E00', () => {
    const screen = regions.find((r) => r.kind === 'screen');
    expect(screen).toBeDefined();
    expect(screen!.start).toBe(0x1e00);
  });

  it('collapses the three system leaves under one band', () => {
    const system = regions.filter((r) => r.group === 'System area');
    expect(system.map((r) => r.kind)).toEqual(['system', 'system', 'system']);
    expect(system[0]!.start).toBe(0x0000);
    expect(system[system.length - 1]!.end).toBe(0x03ff);
  });

  it('collapses the I/O leaves under one band spanning $9000-$97FF', () => {
    const io = regions.filter((r) => r.group === 'I/O area');
    expect(io.length).toBeGreaterThan(1);
    expect(io[0]!.start).toBe(0x9000);
    expect(io[io.length - 1]!.end).toBe(0x97ff);
    // Colour RAM carries the attribute colour within the I/O group.
    expect(io.some((r) => r.kind === 'attributes')).toBe(true);
  });

  it('has three ROM regions (character, BASIC and KERNAL)', () => {
    const rom = regions.filter((r) => r.kind === 'rom');
    expect(rom.map((r) => r.start)).toEqual([0x8000, 0xc000, 0xe000]);
  });
});
