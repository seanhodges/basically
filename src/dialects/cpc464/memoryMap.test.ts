import { describe, it, expect } from 'vitest';
import { cpc464MemoryMap } from './memoryMap';
import { PROGRAM_BASE } from './sysvars';
import { SCREEN_BASE } from './addresses';

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

  it('splits the high area at the boundaries the firmware manual gives', () => {
    // SOFT968 s2.1: the HIGH kernel jumpblock starts at &B900, the firmware
    // jumpblock at &BB00, and the stack sits immediately below &C000.
    const high = regions.filter((r) => r.group === 'System (high)');
    expect(high.map((r) => [r.start, r.end])).toEqual([
      [0xab80, 0xb8ff],
      [0xb900, 0xbaff],
      [0xbb00, 0xbdff],
      [0xbe00, 0xbfff],
    ]);
  });

  it('keeps the BASIC input area as one region below the program', () => {
    // The manual gives &0040-&016F as a single "ROM lower foreground area" of
    // &130 bytes. It is not subdivided at &0100, so this map must not either.
    const input = regions.find((r) => r.start === 0x0040)!;
    expect(input.end).toBe(PROGRAM_BASE - 1);
    expect(input.end - input.start + 1).toBe(0x130);
  });

  it('draws no ROM bands, because the CPC ROMs are read overlays', () => {
    // Writes always land in the RAM beneath, so calling these regions ROM would
    // tell the user a POKE goes nowhere - which is false.
    expect(regions.some((r) => r.kind === 'rom')).toBe(false);
  });
});
