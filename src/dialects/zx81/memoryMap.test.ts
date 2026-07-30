import { describe, it, expect } from 'vitest';
import { zx81MemoryMap } from './memoryMap';
import { PROGRAM_BASE, SYSVARS_BASE, PRBUFF, MEMBOT } from './sysvars';
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
    const echo = regions.filter((r) => r.group === 'Echo region');
    expect(echo[0]!.start).toBe(0x8000);
    expect(echo[echo.length - 1]!.end).toBe(0xffff);
    expect(echo.every((r) => r.kind === 'reserved')).toBe(true);
  });

  it('splits the echo region into its ROM and RAM halves', () => {
    // The lower 32K is 8K of ROM (mirrored) then 16K of RAM, so the echo above
    // it is not uniform: the two halves mirror different things.
    const echo = regions.filter((r) => r.group === 'Echo region');
    expect(echo.map((r) => [r.start, r.end])).toEqual([
      [0x8000, 0xbfff],
      [0xc000, 0xffff],
    ]);
  });

  it('sizes the ROM band to the ROM image the machine loads', () => {
    const rom = regions.find((r) => r.kind === 'rom')!;
    expect(rom.end - rom.start + 1).toBe(ROM_BYTES);
  });

  it('splits the system variables at the boundaries sysvars.ts names', () => {
    // Every boundary is a symbol, not a literal: the map cannot drift from the
    // addresses the tokenizer and the .P builder use.
    const sys = regions.filter((r) => r.group === 'System variables');
    expect(sys.map((r) => [r.start, r.end])).toEqual([
      [0x4000, SYSVARS_BASE - 1],
      [SYSVARS_BASE, PRBUFF - 1],
      [PRBUFF, MEMBOT - 1],
      [MEMBOT, PROGRAM_BASE - 1],
    ]);
  });

  it('marks the printer buffer as a buffer, not workspace', () => {
    const prbuff = regions.find((r) => r.start === PRBUFF)!;
    expect(prbuff.label).toBe('Printer buffer');
    expect(prbuff.kind).toBe('buffer');
  });

  it('keeps the display file inside program RAM rather than a screen region', () => {
    // The ZX81's display file lives in the program area and moves as the program
    // grows, so there is no fixed screen region to draw - and the porting facts
    // cross-check depends on that staying true.
    expect(regions.some((r) => r.kind === 'screen')).toBe(false);
  });
});
