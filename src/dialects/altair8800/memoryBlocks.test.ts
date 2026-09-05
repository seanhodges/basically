// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { altair8800MemoryBlocks } from './memoryBlocks';
import { PROGRAM_BASE, RAM_TOP } from './addresses';

describe('Altair 8800 memory-block support metadata', () => {
  it('assembles blocks as Z80, which is a superset of the 8080 it runs', () => {
    // Not a claim that the machine has a Z80 in it: the union has no '8080',
    // and every 8080 instruction assembles identically as Z80.
    expect(altair8800MemoryBlocks.cpu).toBe('z80');
  });

  it('spans the RAM above the interpreter, up to the top of fitted memory', () => {
    expect(altair8800MemoryBlocks.validRanges).toEqual([
      { start: PROGRAM_BASE, end: RAM_TOP },
    ]);
  });

  it('puts the interpreter outside every valid range, not merely in a warning', () => {
    // A block over 0x0000-0x1938 would overwrite BASIC itself. There is no ROM
    // and no hardware floor to stop it, so the linter has to: an address below
    // the valid range is a hard error rather than a reserved-range warning.
    const inRange = (addr: number) =>
      altair8800MemoryBlocks.validRanges.some(
        (r) => addr >= r.start && addr <= r.end,
      );
    expect(inRange(0x0000)).toBe(false);
    expect(inRange(PROGRAM_BASE - 1)).toBe(false);
    expect(inRange(PROGRAM_BASE)).toBe(true);
    expect(altair8800MemoryBlocks.reservedRanges).toEqual([]);
  });

  it('excludes the empty backplane above the fitted boards', () => {
    const top = altair8800MemoryBlocks.validRanges[0]!.end;
    expect(top).toBe(RAM_TOP);
    expect(top).toBeLessThan(0xffff);
  });

  it('reserves the program area from TXTTAB with ~768 bytes of variable slack', () => {
    expect(altair8800MemoryBlocks.programArea(200)).toEqual({
      start: PROGRAM_BASE,
      end: PROGRAM_BASE + 200 + 768 - 1,
    });
  });

  it('defaults new blocks 4K below the top of RAM', () => {
    const { defaultAddress } = altair8800MemoryBlocks;
    expect(defaultAddress).toBe(0xb000);
    expect(RAM_TOP - defaultAddress).toBe(0x0fff);
  });

  it('is not a listing-based dialect: blocks are RAM injections', () => {
    // The `#BIN`-in-REM convention is a Sinclair thing; here a block is poked
    // into memory alongside the program, as loadProgram() does.
    expect(altair8800MemoryBlocks.inListing).toBeUndefined();
    expect(altair8800MemoryBlocks.listing).toBeUndefined();
  });
});
