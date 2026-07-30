import { describe, it, expect } from 'vitest';
import { spectrum128MemoryMap } from './memoryMap';
import { PROG_BASE } from '../zxspectrum/sysvars';

describe('spectrum128MemoryMap', () => {
  const { addressSpace, regions, udgBase } = spectrum128MemoryMap;

  it('covers a 64K address space', () => {
    expect(addressSpace).toBe(0x10000);
  });

  it('keeps the 48K UDG base so POKE USR "a" resolves', () => {
    expect(udgBase).toBe(0xff58);
  });

  it('starts its usable RAM at the 48K program base', () => {
    // The 128's BASIC runs in the same 48 BASIC ROM, so the bank-5 window opens
    // exactly where a 48K machine's program does.
    const program = regions.find((r) => r.kind === 'program');
    expect(program!.start).toBe(PROG_BASE);
  });

  it('places the paged RAM window at the top 16K', () => {
    const paged = regions[regions.length - 1]!;
    expect(paged.start).toBe(0xc000);
    expect(paged.end).toBe(0xffff);
    expect(paged.kind).toBe('program');
  });

  it('groups the screen bitmap and attributes under one collapsed band', () => {
    const screenGroup = regions.filter((r) => r.group === 'Screen memory');
    expect(screenGroup.map((r) => r.kind)).toEqual(['screen', 'attributes']);
  });

  it('collapses the three RAM spans above the system area into one band', () => {
    const avail = regions.filter((r) => r.group === 'Available memory');
    expect(avail.length).toBe(3);
    expect(avail.every((r) => r.kind === 'program')).toBe(true);
  });
});
