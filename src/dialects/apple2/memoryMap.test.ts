// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { apple2MemoryMap } from './memoryMap';
import { apple2MemoryBlocks } from './memoryBlocks';
import { memoryBands } from '../../components/memoryBands';
import {
  BASIC_BASE,
  BASIC_TOP,
  DEFAULT_HIMEM,
  DEFAULT_LOMEM,
  HIRES_PAGE1,
  IO_BASE,
  IO_TOP,
  MONITOR_BASE,
  PROGRAMMERS_AID_BASE,
  RAM_TOP,
  ROM_BASE,
  ROM_TOP,
  TEXT_PAGE1,
  TEXT_PAGE2,
} from './addresses';

/**
 * The cross-dialect invariants live in `src/dialects/memoryMap.test.ts`, which
 * walks the registry - and this dialect is not in it, so the general ones are
 * asserted here too rather than going unchecked. The rest is what is specific
 * to this machine: a workspace that swallows both display pages, an I/O page
 * that is switches rather than memory, and the boundaries that have to keep
 * tracking `addresses.ts`.
 */
describe('apple2MemoryMap', () => {
  const { addressSpace, regions } = apple2MemoryMap;
  const at = (address: number) =>
    regions.find((r) => address >= r.start && address <= r.end)!;

  it('tiles the whole 64K with contiguous ascending regions', () => {
    expect(addressSpace).toBe(0x10000);
    expect(regions[0]!.start).toBe(0);
    expect(regions[regions.length - 1]!.end).toBe(addressSpace - 1);
    for (let i = 0; i < regions.length; i++) {
      const r = regions[i]!;
      expect(
        r.end,
        `"${r.label}" ends at or after it starts`,
      ).toBeGreaterThanOrEqual(r.start);
      if (i > 0)
        expect(r.start, `"${r.label}" follows the previous region`).toBe(
          regions[i - 1]!.end + 1,
        );
    }
  });

  it('shows one screen region, and it is the page the machine comes up on', () => {
    const screens = regions.filter((r) => r.kind === 'screen');
    expect(screens.map((r) => [r.start, r.end])).toEqual([
      [TEXT_PAGE1, TEXT_PAGE2 - 1],
    ]);
    // No colour memory to pair with it: the lo-res colours are the same bytes
    // read as nibbles, not a second plane.
    expect(regions.filter((r) => r.kind === 'attributes')).toEqual([]);
    // And no character generator in the address space to point a UDG base at.
    expect(apple2MemoryMap.udgBase).toBeUndefined();
  });

  it('gives the whole stock workspace to the program, display pages included', () => {
    const program = regions.filter((r) => r.kind === 'program');
    expect(program[0]!.start).toBe(DEFAULT_LOMEM);
    expect(program[program.length - 1]!.end).toBe(DEFAULT_HIMEM - 1);
    // Contiguous, so the viewer's derived base still bounds the whole area.
    for (let i = 1; i < program.length; i++) {
      expect(program[i]!.start).toBe(program[i - 1]!.end + 1);
    }
    // The hi-res raster is inside it rather than beside it: this interpreter
    // never draws there, so the memory is the program's until a listing says
    // otherwise.
    expect(at(HIRES_PAGE1).kind).toBe('program');
    expect(at(TEXT_PAGE2).kind).toBe('program');
    // HIMEM is the top of the fitted RAM, so nothing sits above the workspace.
    expect(program[program.length - 1]!.end).toBe(RAM_TOP);
  });

  it('starts the program region where the block linter says the program does', () => {
    // The pair the shared battery checks for a registered dialect: the viewer
    // derives its POKE base from the first `program` region, and the linter
    // warns about collisions against `programArea`. Two answers here would put
    // the warning and the picture in different places.
    const program = regions.find((r) => r.kind === 'program')!;
    expect(apple2MemoryBlocks.programArea(0).start).toBe(program.start);
  });

  it('keeps the block window in the one page the workspace does not claim', () => {
    const program = regions.find((r) => r.kind === 'program')!;
    for (const range of apple2MemoryBlocks.validRanges) {
      expect(range.start).toBeGreaterThan(0x02ff);
      expect(range.end).toBeLessThan(program.start);
      // And clear of the screen, which sits between the window and the
      // workspace.
      expect(range.end).toBeLessThan(TEXT_PAGE1);
    }
    // The reserved sub-range is exactly the leaf the map calls firmware
    // vectors, so the linter's warning and the map's note describe one thing.
    const vectors = at(0x03fb);
    expect(apple2MemoryBlocks.reservedRanges).toEqual([
      { start: vectors.start, end: vectors.end },
    ]);
    expect(at(apple2MemoryBlocks.defaultAddress).label).toBe('Free RAM');
  });

  it('splits the I/O page switch by switch, with nothing left as memory', () => {
    const io = regions.filter((r) => r.start >= IO_BASE && r.start <= 0xc0ff);
    expect(io.every((r) => r.kind === 'buffer')).toBe(true);
    expect(io[0]!.start).toBe(IO_BASE);
    expect(io[io.length - 1]!.end).toBe(0xc0ff);
    // The groups the decoder actually implements, at the aliases a program
    // reaches them by: PEEK(-16384) is $C000 and POKE -16368,0 is $C010.
    expect(at(0xc000).label).toBe('Keyboard data');
    expect(at(0xc010).label).toBe('Keyboard strobe');
    expect(at(0xc030).label).toBe('Speaker');
    expect(at(0xc050).label).toBe('Display switches');
    expect(at(0xc057).label).toBe('Display switches');
    expect(at(0xc064).label).toBe('Game connector inputs');
    expect(at(0xc070).label).toBe('Paddle trigger');
    // Card space above the switches, and empty on this machine.
    expect(at(0xc100).kind).toBe('reserved');
    expect(at(IO_TOP).kind).toBe('reserved');
  });

  it('names the four ROM sockets, one of which holds nothing', () => {
    expect([at(PROGRAMMERS_AID_BASE).start, at(ROM_BASE).kind]).toEqual([
      PROGRAMMERS_AID_BASE,
      'rom',
    ]);
    // The unpopulated half of the Programmer's Aid socket is not ROM: it reads
    // as the $FF a floating bus settles to.
    const empty = at(0xd800);
    expect([empty.start, empty.end, empty.kind]).toEqual([
      0xd800,
      BASIC_BASE - 1,
      'reserved',
    ]);
    const basic = at(BASIC_BASE);
    expect([basic.start, basic.end, basic.kind]).toEqual([
      BASIC_BASE,
      BASIC_TOP,
      'rom',
    ]);
    expect(at(MONITOR_BASE).label).toBe('Monitor');
    // The vectors are their own leaf because the reset vector is what makes
    // this machine an Apple II rather than a II Plus.
    const vectors = at(0xfffc);
    expect([vectors.start, vectors.end]).toEqual([0xfffa, ROM_TOP]);
  });

  it('opens into sub-regions when zoomed in, rather than being flat', () => {
    const coarse = memoryBands(apple2MemoryMap, false).map((b) => b.label);
    const detailed = memoryBands(apple2MemoryMap, true).map((b) => b.label);
    expect(coarse).toContain('BASIC workspace');
    expect(coarse).not.toContain('Hi-res page 1');
    expect(detailed).toContain('Hi-res page 1');
    expect(detailed).toContain('Speaker');
    expect(detailed.length).toBeGreaterThan(coarse.length);
  });
});
