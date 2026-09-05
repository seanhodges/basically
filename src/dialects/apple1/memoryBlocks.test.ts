// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apple1MemoryBlocks } from './memoryBlocks';
import { apple1 } from './index';
import { DEFAULT_HIMEM, DEFAULT_LOMEM, PP } from './addresses';
import { Apple1Machine } from '../../emulator/apple1/apple1Machine';

const ROM = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/apple1.rom')),
);

const { validRanges, reservedRanges, programArea, defaultAddress } =
  apple1MemoryBlocks;

const inValidRange = (address: number) =>
  validRanges.some((r) => address >= r.start && address <= r.end);

describe('Apple I memory-block support metadata', () => {
  it('assembles blocks as 6502', () => {
    expect(apple1MemoryBlocks.cpu).toBe('6502');
  });

  it('offers only the RAM below LOMEM, the rest not being fitted', () => {
    // $1000-$DFFF is decoded and empty on a stock machine, so the window
    // every other 8-bit here has above its program simply does not exist.
    expect(validRanges).toEqual([{ start: 0x0300, end: DEFAULT_LOMEM - 1 }]);
    expect(reservedRanges).toEqual([]);
  });

  it('stops short of the line buffer the interpreter crunches in', () => {
    // $0200-$027F is where the monitor assembles a typed line and Integer
    // BASIC turns it into tokens, so a block reaching into it is overwritten
    // by the next thing typed - the RUN that starts the program included.
    expect(inValidRange(0x0280)).toBe(false);
    expect(inValidRange(0x02ff)).toBe(false);
    expect(inValidRange(0x0300)).toBe(true);
  });

  it('excludes the workspace, the interpreter and the monitor', () => {
    expect(inValidRange(DEFAULT_LOMEM)).toBe(false);
    expect(inValidRange(0xe000)).toBe(false);
    expect(inValidRange(0xff00)).toBe(false);
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
    expect(apple1MemoryBlocks.inListing).toBeUndefined();
    expect(apple1MemoryBlocks.listing).toBeUndefined();
  });
});

describe('a block through the machine', () => {
  it('lands where it was asked for and survives the run', () => {
    // The round trip that matters: the block is written after the cold start
    // has walked the workspace and before RUN, so it has to still be there
    // once BASIC has finished with the program - which is the whole reason the
    // window sits below LOMEM.
    const bytes = new Uint8Array([0xa9, 0x2a, 0x60]); // LDA #'*' : RTS
    const machine = new Apple1Machine({ rom: ROM });
    const { image, errors } = apple1.tokenize('10 A=1\n20 END');
    expect(errors).toEqual([]);
    machine.loadProgram(image, {
      blocks: [{ address: defaultAddress!, bytes }],
    });
    for (let field = 0; field < 4000; field++) {
      machine.runFrame();
      if (machine.isProgramRunning() === false) break;
    }
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
  });
});

/**
 * A program that lowers LOMEM takes the block window's RAM for its own
 * workspace, so a block sitting there would be written over. The collision lint
 * only sees that if the area follows the program's own bounds.
 */
describe('a workspace the program moved', () => {
  const stock = { start: DEFAULT_LOMEM, end: DEFAULT_HIMEM - 1 };

  it('follows a LOMEM= preamble down into the block window', () => {
    expect(programArea(0, 'LOMEM=768\n10 END')).toEqual({
      start: 0x0300,
      end: 0x0fff,
    });
  });

  it('follows a HIMEM= preamble down from the top', () => {
    expect(programArea(0, 'LOMEM=768\nHIMEM=2048\n10 END')).toEqual({
      start: 0x0300,
      end: 0x07ff,
    });
  });

  it('is the stock workspace for a listing that asks for nothing', () => {
    expect(programArea(0, '10 END')).toEqual(stock);
    expect(programArea(0)).toEqual(stock);
  });

  it('ignores bounds the machine could not hold', () => {
    expect(programArea(0, 'LOMEM=16\n10 END')).toEqual(stock);
  });
});
