import { describe, it, expect } from 'vitest';
import { zx81MemoryMap } from './memoryMap';
import { PROGRAM_BASE } from './sysvars';
import { ROM_BYTES } from './emulator/memory';

describe('zx81MemoryMap', () => {
  const { addressSpace, regions } = zx81MemoryMap;

  it('covers a 64K address space', () => {
    expect(addressSpace).toBe(0x10000);
  });

  it('starts the BASIC program area at PROGRAM_BASE', () => {
    const program = regions.find((r) => r.kind === 'program');
    expect(program).toBeDefined();
    expect(program!.start).toBe(PROGRAM_BASE);
  });

  it('collapses the two ROM leaves under one band', () => {
    const romGroup = regions.filter((r) => r.group === 'ROM');
    expect(romGroup.map((r) => r.kind)).toEqual(['rom', 'rom']);
  });

  it('marks the upper 32K as the reserved echo region', () => {
    const echo = regions[regions.length - 1]!;
    expect(echo.start).toBe(0x8000);
    expect(echo.kind).toBe('reserved');
  });
  it('sizes the ROM band to the ROM image the machine loads', () => {
    const rom = regions.find((r) => r.kind === 'rom')!;
    expect(rom.end - rom.start + 1).toBe(ROM_BYTES);
  });
});
