import { describe, it, expect } from 'vitest';
import { spectrumMemoryMap } from './memoryMap';
import { PROG_BASE } from './sysvars';
import { ROM_BYTES } from './emulator/memory';

describe('spectrumMemoryMap', () => {
  const { addressSpace, regions } = spectrumMemoryMap;

  it('covers a 64K address space', () => {
    expect(addressSpace).toBe(0x10000);
  });

  it('places the BASIC program area where PROG/RAMTOP defaults sit on a 48K machine', () => {
    const program = regions.find((r) => r.kind === 'program');
    expect(program).toBeDefined();
    expect(program!.start).toBe(PROG_BASE);
    expect(program!.end).toBe(0xff57);
  });

  it('groups the screen bitmap and attributes under one collapsed band', () => {
    const screenGroup = regions.filter((r) => r.group === 'Screen memory');
    expect(screenGroup.map((r) => r.kind)).toEqual(['screen', 'attributes']);
  });
  it('sizes the ROM band to the ROM image the machine loads', () => {
    const rom = regions.find((r) => r.kind === 'rom')!;
    expect(rom.end - rom.start + 1).toBe(ROM_BYTES);
  });
});
