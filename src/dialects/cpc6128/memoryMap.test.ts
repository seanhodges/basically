import { describe, it, expect } from 'vitest';
import { cpc6128MemoryMap } from './memoryMap';
import { cpc464MemoryMap } from '../cpc464/memoryMap';
import { PROGRAM_BASE } from '../cpc464/sysvars';
import { SCREEN_BASE } from '../../emulator/cpc/memory';

describe('cpc6128MemoryMap', () => {
  const { addressSpace, regions } = cpc6128MemoryMap;

  it('covers a 64K address space, not 128K', () => {
    // The extra 64K is banked *over* these addresses, not addressable beside
    // them - see the note in memoryMap.ts (the Spectrum 128 precedent).
    expect(addressSpace).toBe(0x10000);
  });

  it('places the BASIC program area from &0170 up to the default HIMEM', () => {
    const program = regions.find((r) => r.kind === 'program');
    expect(program).toBeDefined();
    expect(program!.start).toBe(PROGRAM_BASE);
    // HIMEM reads &AB7F on a clean 6128 boot, same as the 464.
    expect(program!.end).toBe(0xab7f);
  });

  it('maps the 16K screen at its power-on &C000–&FFFF address', () => {
    const screen = regions.find((r) => r.kind === 'screen');
    expect(screen).toBeDefined();
    expect(screen!.start).toBe(SCREEN_BASE);
    expect(screen!.end).toBe(0xffff);
  });

  it('draws the same bands as the 464, differing only in wording', () => {
    // The machines share a 64K layout; if that stops being true the two maps
    // should stop being parallel deliberately, not by drift.
    expect(regions.map((r) => [r.start, r.end, r.kind])).toEqual(
      cpc464MemoryMap.regions.map((r) => [r.start, r.end, r.kind]),
    );
  });

  it('explains the banked second 64K in the notes rather than as a band', () => {
    const notes = regions.map((r) => r.note ?? '').join(' ');
    expect(notes).toMatch(/second/i);
    expect(notes).toMatch(/configuration/i);
  });
});
