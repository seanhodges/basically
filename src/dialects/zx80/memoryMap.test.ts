import { describe, it, expect } from 'vitest';
import { zx80MemoryMap } from './memoryMap';
import { PROGRAM_BASE, VARS, DF_EA } from './sysvars';
import { ROM_BYTES } from './emulator/memory';

describe('zx80MemoryMap', () => {
  const { addressSpace, regions } = zx80MemoryMap;

  it('covers a 64K address space', () => {
    expect(addressSpace).toBe(0x10000);
  });

  it('starts the BASIC program area at PROGRAM_BASE', () => {
    const program = regions.find((r) => r.kind === 'program');
    expect(program).toBeDefined();
    expect(program!.start).toBe(PROGRAM_BASE);
  });

  it('uses the smaller 4K ROM window before RAM begins', () => {
    const rom = regions.filter((r) => r.kind === 'rom');
    expect(rom[0]!.start).toBe(0);
    // ROM + its mirrors run right up to the start of RAM at 0x4000.
    expect(rom[rom.length - 1]!.end).toBe(0x3fff);
  });

  it('marks the upper 32K as the reserved echo region', () => {
    const echo = regions.filter((r) => r.group === 'Echo region');
    expect(echo[0]!.start).toBe(0x8000);
    expect(echo[echo.length - 1]!.end).toBe(0xffff);
    expect(echo.every((r) => r.kind === 'reserved')).toBe(true);
  });

  it('splits the echo region into its ROM and RAM halves', () => {
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

  it('splits the system variables at the pointers sysvars.ts names', () => {
    const sys = regions.filter((r) => r.group === 'System variables');
    expect(sys.map((r) => [r.start, r.end])).toEqual([
      [0x4000, VARS - 1],
      [VARS, DF_EA + 1],
      [DF_EA + 2, PROGRAM_BASE - 1],
    ]);
  });

  it('says the workspace above DF_EA is undocumented rather than naming it', () => {
    // sysvars.ts names nothing above DF_EA, so the map must not invent a purpose
    // for those bytes - see the naming rule in the memory-map capability.
    const workspace = regions.find((r) => r.start === DF_EA + 2)!;
    expect(workspace.label).toMatch(/undocumented/i);
    expect(workspace.note).toMatch(/does not document/i);
  });

  it('keeps the display file inside program RAM rather than a screen region', () => {
    expect(regions.some((r) => r.kind === 'screen')).toBe(false);
  });
});
