// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { sorcererMemoryBlocks } from './memoryBlocks';
import {
  BASIC_CONTROL_BASE,
  BASIC_MEMORY_TOP,
  PROGRAM_BASE,
  RAM_FITTED_BYTES,
  ROM_PAC_BASE,
  SCREEN_BASE,
} from './addresses';

const inRange = (addr: number): boolean =>
  sorcererMemoryBlocks.validRanges.some(
    (r) => addr >= r.start && addr <= r.end,
  );

describe('Sorcerer memory-block support metadata', () => {
  it('assembles blocks as the Z80 the machine really has', () => {
    expect(sorcererMemoryBlocks.cpu).toBe('z80');
  });

  it('spans the RAM above the control area, up to where BASIC’s memory ends', () => {
    expect(sorcererMemoryBlocks.validRanges).toEqual([
      { start: PROGRAM_BASE, end: BASIC_MEMORY_TOP },
    ]);
    // A page short of the top of fitted RAM, not at it: the Monitor's workarea
    // and its stack are up there, and a block among them would be overwritten
    // the moment a Monitor routine ran - which loading the block is.
    expect(RAM_FITTED_BYTES - 1 - BASIC_MEMORY_TOP).toBe(0x100);
  });

  it('keeps the default address clear of BASIC and the Monitor workarea', () => {
    const { defaultAddress } = sorcererMemoryBlocks;
    expect(inRange(defaultAddress)).toBe(true);
    // Just under 4K below the top of BASIC's memory: far above any plausible
    // program and its variables, far below the stack and the string pool
    // growing down from the top.
    const top = sorcererMemoryBlocks.validRanges[0]!.end;
    expect(top - defaultAddress).toBe(0x0eff);
    // And low enough to POKE in decimal: this interpreter takes a signed
    // 16-bit address, so a block at or above 32768 could not be poked at all
    // without negative arithmetic.
    expect(defaultAddress).toBeLessThan(0x8000);
  });

  it('rejects a block that would land in the control area, ROM or screen RAM', () => {
    // No hardware says no to the first of those: a block over the interpreter's
    // own pointers takes BASIC down with it, so it is a hard error rather than
    // a reserved-range warning.
    expect(inRange(BASIC_CONTROL_BASE)).toBe(false);
    expect(inRange(PROGRAM_BASE - 1)).toBe(false);
    expect(inRange(PROGRAM_BASE)).toBe(true);
    expect(inRange(ROM_PAC_BASE)).toBe(false);
    expect(inRange(SCREEN_BASE)).toBe(false);
    expect(sorcererMemoryBlocks.reservedRanges).toEqual([]);
  });

  it('reserves the program area from the program base with ~768 bytes of slack', () => {
    expect(sorcererMemoryBlocks.programArea(200)).toEqual({
      start: PROGRAM_BASE,
      end: PROGRAM_BASE + 200 + 768 - 1,
    });
  });

  it('is not a listing-based dialect: blocks are RAM injections', () => {
    expect(sorcererMemoryBlocks.inListing).toBeUndefined();
    expect(sorcererMemoryBlocks.listing).toBeUndefined();
  });
});
