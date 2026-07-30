import { describe, it, expect } from 'vitest';
import { cpc464MemoryMap } from './memoryMap';
import { PROGRAM_BASE } from './sysvars';
import { SCREEN_BASE } from '../../emulator/cpc/memory';

describe('cpc464MemoryMap', () => {
  const { addressSpace, regions } = cpc464MemoryMap;

  it('covers a 64K address space', () => {
    expect(addressSpace).toBe(0x10000);
  });

  it('places the BASIC program area from &0170 up to the default HIMEM', () => {
    const program = regions.find((r) => r.kind === 'program');
    expect(program).toBeDefined();
    expect(program!.start).toBe(PROGRAM_BASE);
    expect(program!.end).toBe(0xab7f);
  });

  it('maps the 16K screen at its power-on &C000–&FFFF address', () => {
    const screen = regions.find((r) => r.kind === 'screen');
    expect(screen).toBeDefined();
    expect(screen!.start).toBe(SCREEN_BASE);
    expect(screen!.end).toBe(0xffff);
  });
});
