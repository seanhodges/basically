import { describe, it, expect } from 'vitest';
import { cpc464MemoryMap } from './memoryMap';

describe('cpc464MemoryMap', () => {
  const { addressSpace, regions } = cpc464MemoryMap;

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
      if (i > 0) expect(r.start).toBe(regions[i - 1]!.end + 1);
    }
  });

  it('places the BASIC program area from &0170 up to the default HIMEM', () => {
    const program = regions.find((r) => r.kind === 'program');
    expect(program).toBeDefined();
    expect(program!.start).toBe(0x0170);
    expect(program!.end).toBe(0xab7f);
  });

  it('maps the 16K screen at its power-on &C000–&FFFF address', () => {
    const screen = regions.find((r) => r.kind === 'screen');
    expect(screen).toBeDefined();
    expect(screen!.start).toBe(0xc000);
    expect(screen!.end).toBe(0xffff);
  });
});
