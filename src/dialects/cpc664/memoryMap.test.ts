import { describe, it, expect } from 'vitest';
import { cpc664MemoryMap } from './memoryMap';
import { cpc464MemoryMap } from '../cpc464/memoryMap';
import { cpc6128MemoryMap } from '../cpc6128/memoryMap';
import { PROGRAM_BASE } from '../cpc464/sysvars';
import { SCREEN_BASE } from '../cpc464/addresses';

describe('cpc664MemoryMap', () => {
  const { addressSpace, regions } = cpc664MemoryMap;

  it("covers the machine's flat 64K", () => {
    expect(addressSpace).toBe(0x10000);
  });

  it('places the BASIC program area from &0170 up to the default HIMEM', () => {
    const program = regions.find((r) => r.kind === 'program');
    expect(program).toBeDefined();
    expect(program!.start).toBe(PROGRAM_BASE);
    // HIMEM reads &AB7F on a clean 664 boot, same as the other two CPCs: BASIC
    // 1.1 moved its workspace pointers but not the top of user memory.
    expect(program!.end).toBe(0xab7f);
  });

  it('maps the 16K screen at its power-on &C000–&FFFF address', () => {
    const screen = regions.find((r) => r.kind === 'screen');
    expect(screen).toBeDefined();
    expect(screen!.start).toBe(SCREEN_BASE);
    expect(screen!.end).toBe(0xffff);
  });

  it('draws the same bands as the other CPCs, differing only in wording', () => {
    // The family shares a 64K layout; if that stops being true these maps
    // should stop being parallel deliberately, not by drift.
    const bands = (m: typeof cpc664MemoryMap) =>
      m.regions.map((r) => [r.start, r.end, r.kind]);
    expect(bands(cpc664MemoryMap)).toEqual(bands(cpc464MemoryMap));
    expect(bands(cpc664MemoryMap)).toEqual(bands(cpc6128MemoryMap));
  });

  it('labels the workspace as 1.1, and describes no second bank', () => {
    expect(regions.some((r) => r.label.includes('1.1'))).toBe(true);
    // Only the 6128 has RAM to bank; the 664's notes must not claim otherwise.
    const notes = regions.map((r) => r.note ?? '').join(' ');
    expect(notes).not.toMatch(/second 64K|configuration/i);
  });
});
