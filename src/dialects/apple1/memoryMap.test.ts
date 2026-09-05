// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { apple1MemoryMap } from './memoryMap';
import { apple1MemoryBlocks } from './memoryBlocks';
import {
  BASIC_BASE,
  BASIC_TOP,
  DEFAULT_HIMEM,
  DEFAULT_LOMEM,
  KBD,
  KBDCR,
  DSP,
  DSPCR,
  MONITOR_BASE,
  RAM_TOP,
} from './addresses';

/**
 * The cross-dialect invariants - contiguity, coverage, one screen region, the
 * program base agreeing with `memoryBlocks` - are checked for every registered
 * dialect in `src/dialects/memoryMap.test.ts`. What is here is what is specific
 * to this machine: how little of the space is fitted, the PIA seen four times
 * over, and the boundaries that have to keep tracking `addresses.ts`.
 */
describe('apple1MemoryMap', () => {
  const { addressSpace, regions } = apple1MemoryMap;
  const at = (address: number) =>
    regions.find((r) => address >= r.start && address <= r.end)!;

  it('covers a 64K address space', () => {
    expect(addressSpace).toBe(0x10000);
  });

  it('has no screen or attribute region, there being no display memory', () => {
    // The display is a shift register the CPU pushes one character into at a
    // time; there is no matrix in the address space to colour in.
    expect(regions.filter((r) => r.kind === 'screen')).toEqual([]);
    expect(regions.filter((r) => r.kind === 'attributes')).toEqual([]);
    expect(apple1MemoryMap.udgBase).toBeUndefined();
  });

  it('fits 4K of RAM and leaves the rest of the low half empty', () => {
    expect(at(RAM_TOP).kind).not.toBe('reserved');
    const gap = at(RAM_TOP + 1);
    expect(gap.label).toBe('Not fitted');
    expect(gap.end).toBe(0xbfff);
  });

  it('puts the workspace between the stock LOMEM and HIMEM', () => {
    const program = regions.find((r) => r.kind === 'program')!;
    expect([program.start, program.end]).toEqual([
      DEFAULT_LOMEM,
      DEFAULT_HIMEM - 1,
    ]);
    // HIMEM is the top of the fitted RAM, so there is nothing above the
    // workspace for a program to raise it into.
    expect(program.end).toBe(RAM_TOP);
  });

  it('keeps the block window clear of the workspace', () => {
    const program = regions.find((r) => r.kind === 'program')!;
    for (const range of apple1MemoryBlocks.validRanges) {
      expect(range.end).toBeLessThan(program.start);
    }
  });

  it('names the four PIA registers and calls the rest of the page mirrors', () => {
    const pia = at(KBD);
    expect([pia.start, pia.end]).toEqual([KBD, DSPCR]);
    for (const reg of [KBD, KBDCR, DSP, DSPCR]) expect(at(reg)).toBe(pia);
    // The board decodes the page and A4 alone, so the same four registers
    // answer every 16 bytes across $D000-$DFFF - which is why the neighbours
    // are labelled as the same chip rather than as empty space.
    expect(at(0xd000).label).toBe('PIA (mirrored)');
    expect(at(0xdfff).label).toBe('PIA (mirrored)');
    expect(at(KBD + 0x10).label).toBe('PIA (mirrored)');
  });

  it('marks the two halves of the supplied firmware as the ROM they act as', () => {
    const basic = at(BASIC_BASE);
    expect([basic.start, basic.end, basic.kind]).toEqual([
      BASIC_BASE,
      BASIC_TOP,
      'rom',
    ]);
    const monitor = at(MONITOR_BASE);
    expect([monitor.start, monitor.end, monitor.kind]).toEqual([
      MONITOR_BASE,
      0xffff,
      'rom',
    ]);
    // The reset vector is inside the monitor page, which is what makes the
    // machine able to start at all.
    expect(at(0xfffc)).toBe(monitor);
  });

  it('leaves the expansion space for the cassette card', () => {
    expect(at(0xc081).label).toBe('Cassette interface');
    expect(at(0xc100).label).toBe('Expansion PROM');
  });
});
