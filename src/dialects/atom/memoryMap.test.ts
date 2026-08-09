import { describe, it, expect } from 'vitest';
import { atomMemoryMap } from './memoryMap';
import { RAM_END, TEXT_START, VIDEO_BASE, VIDEO_TOP } from './addresses';

describe('atomMemoryMap', () => {
  const { addressSpace, regions } = atomMemoryMap;

  it('covers a 64K address space', () => {
    expect(addressSpace).toBe(0x10000);
  });

  it('runs the BASIC program area across the fitted internal RAM', () => {
    const program = regions.find((r) => r.kind === 'program');
    expect(program).toBeDefined();
    expect(program!.start).toBe(TEXT_START);
    expect(program!.end).toBe(RAM_END);
  });

  /**
   * A 12K Atom populates three separate runs of RAM, and the map has to show
   * the holes: quoting a program budget that reaches the screen was the bug
   * this file now guards against.
   */
  it('marks the space between the fitted RAM runs as unfitted', () => {
    const unfitted = (addr: number) =>
      regions.find((r) => addr >= r.start && addr <= r.end)!;
    expect(unfitted(0x0400).kind).toBe('reserved');
    expect(unfitted(0x5000).kind).toBe('reserved');
    expect(unfitted(VIDEO_TOP).kind).toBe('reserved');
  });

  it('marks the VDG video RAM as the 6K fitted from 0x8000', () => {
    const screen = regions.find((r) => r.kind === 'screen');
    expect(screen).toBeDefined();
    expect(screen!.start).toBe(VIDEO_BASE);
    expect(screen!.end).toBe(VIDEO_TOP - 1);
  });

  it('groups the ROM leaves under one band', () => {
    const rom = regions.filter((r) => r.group === 'ROM');
    expect(rom.length).toBeGreaterThan(1);
    expect(rom.every((r) => r.kind === 'rom')).toBe(true);
  });

  it('has no udgBase (Atom BASIC has no USR-letter UDG area)', () => {
    expect(atomMemoryMap.udgBase).toBeUndefined();
  });
});
