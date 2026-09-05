// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { apple2plusMemoryBlocks } from './memoryBlocks';
import { apple2plus } from './index';
import { DEFAULT_MEMSIZ, PROGRAM_BASE, VARTAB } from './addresses';
import { bootMachine, hasRom, runUntil } from '../bootHarness';

const { validRanges, reservedRanges, programArea, defaultAddress } =
  apple2plusMemoryBlocks;

const inValidRange = (address: number) =>
  validRanges.some((r) => address >= r.start && address <= r.end);
const inReservedRange = (address: number) =>
  reservedRanges.some((r) => address >= r.start && address <= r.end);

describe('Apple II Plus memory-block support metadata', () => {
  it('assembles blocks as 6502', () => {
    expect(apple2plusMemoryBlocks.cpu).toBe('6502');
  });

  it('offers page 3, the only RAM neither end of the machine claims', () => {
    expect(validRanges).toEqual([{ start: 0x0300, end: 0x03ff }]);
    // Below it: zero page, the stack, the line buffer and text page 1.
    expect(inValidRange(0x0200)).toBe(false);
    expect(inValidRange(0x02ff)).toBe(false);
    expect(inValidRange(0x0400)).toBe(false);
    // Above it: the workspace, the I/O page and the ROM window.
    expect(inValidRange(PROGRAM_BASE)).toBe(false);
    expect(inValidRange(0xc000)).toBe(false);
    expect(inValidRange(0xe000)).toBe(false);
  });

  it('warns on sixteen bytes of vectors, not the sibling’s eight', () => {
    // The Autostart Monitor's RESET re-entry and its checksum sit below the
    // three vectors the original monitor keeps, and Applesoft's `&` vector sits
    // between them.
    expect(reservedRanges).toEqual([{ start: 0x03f0, end: 0x03ff }]);
    expect(inReservedRange(0x03ef)).toBe(false);
    expect(inReservedRange(0x03f2)).toBe(true);
  });

  it('names the whole workspace as the program area, whatever the program', () => {
    // The program grows up from $0801 and the string space down from MEMSIZ, so
    // both ends are occupied and the free space is in the middle.
    const whole = { start: PROGRAM_BASE, end: DEFAULT_MEMSIZ - 1 };
    expect(programArea(0)).toEqual(whole);
    expect(programArea(2000)).toEqual(whole);
    // And no listing moves it: unlike the sibling there is no preamble to read.
    expect(programArea(0, 'HIMEM: 8192\n10 END')).toEqual(whole);
  });

  it('defaults to the bottom of the window', () => {
    expect(defaultAddress).toBe(validRanges[0]!.start);
    expect(inValidRange(defaultAddress!)).toBe(true);
  });

  it('is not a listing-based dialect: a block is a RAM injection', () => {
    expect(apple2plusMemoryBlocks.inListing).toBeUndefined();
    expect(apple2plusMemoryBlocks.listing).toBeUndefined();
  });
});

const describeOnRom = hasRom(apple2plus) ? describe : describe.skip;

describeOnRom('a block through the machine', () => {
  it('lands where it was asked for and survives the run', async () => {
    // The round trip that matters: the block is written after the cold start
    // has laid its workspace down and before RUN, so it has to still be there
    // once BASIC has finished - which is the whole reason the window sits below
    // the program base.
    const bytes = new Uint8Array([0xa9, 0x2a, 0x60]); // LDA #'*' : RTS
    const machine = await bootMachine(apple2plus);
    try {
      const { image, errors } = apple2plus.tokenize('10 A=1\n20 END');
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
      // And the program is where the interpreter keeps it, above the block
      // rather than over it.
      const vartab = ram[VARTAB]! | (ram[VARTAB + 1]! << 8);
      expect(vartab).toBeGreaterThan(PROGRAM_BASE);
      expect(vartab).toBeGreaterThan(defaultAddress! + bytes.length);
    } finally {
      machine.dispose();
    }
  });

  it('is the RESET vectors, not the interpreter, that claim $03F0-$03F4', async () => {
    // The reserved range is measured rather than declared: a page filled with a
    // marker and then booted through shows exactly which bytes the firmware
    // writes for itself, and RESET is the moment it writes them.
    const marker = 0xee;
    const machine = await bootMachine(apple2plus);
    try {
      const { image } = apple2plus.tokenize('10 END');
      machine.loadProgram(image, {
        blocks: [{ address: 0x0300, bytes: new Uint8Array(256).fill(marker) }],
      });
      await runUntil(machine, () => machine.isProgramRunning() === false, 600);
      const ram = machine.mem.mem;
      // Running a program touches none of the page.
      expect([...ram.subarray(0x0300, 0x0400)].every((b) => b === marker)).toBe(
        true,
      );

      machine.pressReset();
      await runUntil(machine, () => false, 30);
      const written: number[] = [];
      for (let a = 0x0300; a <= 0x03ff; a++)
        if (ram[a] !== marker) written.push(a);
      expect(written).toEqual([0x03f0, 0x03f1, 0x03f2, 0x03f3, 0x03f4]);
      // SOFTEV is Applesoft's warm start, and PWREDUP is its high byte EOR $A5
      // - which is what the monitor checks before honouring it.
      expect(ram[0x03f2]! | (ram[0x03f3]! << 8)).toBe(0xe003);
      expect(ram[0x03f4]).toBe(ram[0x03f3]! ^ 0xa5);
      // Every byte it wrote is inside the range the linter warns about.
      expect(written.every(inReservedRange)).toBe(true);
    } finally {
      machine.dispose();
    }
  });
});
