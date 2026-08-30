// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { apple2MemoryBlocks } from './memoryBlocks';
import { apple2 } from './index';
import { DEFAULT_HIMEM, DEFAULT_LOMEM, PP } from './addresses';
import { bootMachine, hasRom, runUntil } from '../bootHarness';

const { validRanges, reservedRanges, programArea, defaultAddress } =
  apple2MemoryBlocks;

const inValidRange = (address: number) =>
  validRanges.some((r) => address >= r.start && address <= r.end);

describe('Apple II memory-block support metadata', () => {
  it('assembles blocks as 6502', () => {
    expect(apple2MemoryBlocks.cpu).toBe('6502');
  });

  it('offers page 3, the only RAM neither end of the machine claims', () => {
    // Below it: zero page, the stack, the monitor's line buffer and text page
    // 1. Above it: the cold start's workspace, which runs from $0800 to the top
    // of RAM - so unlike every machine that grows its program up from a base,
    // there is no window above the program either.
    expect(validRanges).toEqual([{ start: 0x0300, end: 0x03ff }]);
  });

  it('warns on the monitor’s vector block at the top of the page', () => {
    // Nothing writes $03F8-$03FF, so a block there runs; what it costs is the
    // monitor's CTRL-Y jump ($03F8), the NMI vector ($03FB, where $FFFA points)
    // and the non-BRK interrupt vector ($03FE).
    expect(reservedRanges).toEqual([{ start: 0x03f8, end: 0x03ff }]);
  });

  it('stops short of the line buffer the interpreter crunches in', () => {
    // $0200-$02FF is where the monitor assembles a typed line and Integer BASIC
    // turns it into tokens, so a block reaching into it is overwritten by the
    // next thing typed - the RUN that starts the program included.
    expect(inValidRange(0x0200)).toBe(false);
    expect(inValidRange(0x02ff)).toBe(false);
    expect(inValidRange(0x0300)).toBe(true);
  });

  it('excludes the text page, the workspace, the I/O page and the ROM', () => {
    expect(inValidRange(0x0400)).toBe(false);
    expect(inValidRange(DEFAULT_LOMEM)).toBe(false);
    expect(inValidRange(0xc000)).toBe(false);
    expect(inValidRange(0xe000)).toBe(false);
  });

  it('names the whole workspace as the program area, whatever the program', () => {
    // The program grows down from HIMEM and the variables up from LOMEM, so
    // both ends are occupied and the free space is in the middle. A range from
    // a base to "program plus slack" would name the half guaranteed to be
    // empty, which is why this does not depend on the size passed.
    const whole = { start: DEFAULT_LOMEM, end: DEFAULT_HIMEM - 1 };
    expect(programArea(0)).toEqual(whole);
    expect(programArea(2000)).toEqual(whole);
  });

  it('defaults to the bottom of the window', () => {
    expect(defaultAddress).toBe(validRanges[0]!.start);
    expect(inValidRange(defaultAddress!)).toBe(true);
  });

  it('is not a listing-based dialect: a block is a RAM injection', () => {
    // The `#BIN`-in-REM convention is a Sinclair thing; here a block is written
    // into memory alongside the program, as loadProgram() does.
    expect(apple2MemoryBlocks.inListing).toBeUndefined();
    expect(apple2MemoryBlocks.listing).toBeUndefined();
  });
});

/**
 * A program that lowers LOMEM takes the block window's RAM for its own
 * workspace, so a block sitting there would be written over. The collision lint
 * only sees that if the area follows the program's own bounds.
 */
describe('a workspace the program moved', () => {
  const stock = { start: DEFAULT_LOMEM, end: DEFAULT_HIMEM - 1 };

  it('follows a HIMEM: preamble down from the top', () => {
    expect(programArea(0, 'HIMEM:8192\n10 END')).toEqual({
      start: DEFAULT_LOMEM,
      end: 0x1fff,
    });
  });

  it('is the stock workspace for a listing that asks for nothing', () => {
    expect(programArea(0, '10 END')).toEqual(stock);
    expect(programArea(0)).toEqual(stock);
  });

  it('ignores bounds the machine could not keep', () => {
    // $0800 is the lowest LOMEM this machine can hold: below it the workspace
    // is overwritten by text page 1 and the line buffer.
    expect(programArea(0, 'LOMEM:768\n10 END')).toEqual(stock);
  });
});

const describeOnRom = hasRom(apple2) ? describe : describe.skip;

describeOnRom('a block through the machine', () => {
  it('lands where it was asked for and survives the run', async () => {
    // The round trip that matters: the block is written after the cold start
    // has walked the workspace and before RUN, so it has to still be there once
    // BASIC has finished with the program - which is the whole reason the
    // window sits below LOMEM.
    const bytes = new Uint8Array([0xa9, 0x2a, 0x60]); // LDA #'*' : RTS
    const machine = await bootMachine(apple2);
    try {
      const { image, errors } = apple2.tokenize('10 A=1\n20 END');
      expect(errors).toEqual([]);
      machine.loadProgram(image, {
        blocks: [{ address: defaultAddress!, bytes }],
      });
      await runUntil(machine, () => machine.isProgramRunning() === false, 600);
      expect(machine.isProgramRunning()).toBe(false);

      const ram = machine.mem.mem;
      expect([
        ...ram.subarray(defaultAddress!, defaultAddress! + bytes.length),
      ]).toEqual([...bytes]);
      // And the program it was loaded beside is where the interpreter keeps it,
      // above the block rather than over it.
      const pp = ram[PP]! | (ram[PP + 1]! << 8);
      expect(pp).toBeGreaterThanOrEqual(DEFAULT_LOMEM);
      expect(pp).toBeGreaterThan(defaultAddress! + bytes.length);
    } finally {
      machine.dispose();
    }
  });
});
