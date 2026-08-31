// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { apple2plusMemoryMap } from './memoryMap';
import { apple2plusMemoryBlocks } from './memoryBlocks';
import { memoryBands } from '../../components/memoryBands';
import { apple2MemoryMap } from '../apple2/memoryMap';
import {
  HIRES_PAGE1,
  HIRES_PAGE2,
  IO_BASE,
  IO_TOP,
  RAM_TOP,
  ROM_BASE,
  ROM_TOP,
  TEXT_PAGE1,
  TEXT_PAGE2,
} from '../apple2/addresses';
import {
  BASIC_BASE,
  BASIC_TOP,
  DEFAULT_MEMSIZ,
  MONITOR_BASE,
  PROGRAM_BASE,
} from './addresses';

/**
 * The cross-dialect invariants live in `src/dialects/memoryMap.test.ts`, which
 * walks the registry - and this dialect is not in it, so the general ones are
 * asserted here too rather than going unchecked. The rest is what is specific
 * to this machine: a workspace that swallows both hi-res pages *even though*
 * this interpreter draws in them, a ROM window split in two rather than four,
 * and the board's bounds coming from the sibling so the two maps cannot
 * disagree about the hardware.
 */
describe('apple2plusMemoryMap', () => {
  const { addressSpace, regions } = apple2plusMemoryMap;
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

  it('wires the I/O page exactly as the sibling does, being the same board', () => {
    // The switches are the one part of the map that is entirely hardware, with
    // no interpreter opinion in it: a leaf that moved or was renamed here would
    // mean one of the two maps had stopped tracking the board. Everything else
    // may legitimately differ, and page 3 and the ROM window do.
    const wires = (map: typeof apple2plusMemoryMap) =>
      map.regions
        .filter((r) => r.start >= IO_BASE && r.start < ROM_BASE)
        .map((r) => [r.start, r.end, r.label]);
    expect(wires(apple2plusMemoryMap)).toEqual(wires(apple2MemoryMap));
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
    expect(apple2plusMemoryMap.udgBase).toBeUndefined();
  });

  it('gives the whole stock workspace to the program, hi-res pages included', () => {
    const program = regions.filter((r) => r.kind === 'program');
    // From the first byte the cold start claims to the last: the zero link byte
    // at $0800 sits below TXTTAB, and MEMSIZ is the top of the fitted RAM.
    expect(program[0]!.start).toBe(TEXT_PAGE2);
    expect(PROGRAM_BASE).toBe(program[0]!.start + 1);
    expect(program[program.length - 1]!.end).toBe(DEFAULT_MEMSIZ - 1);
    expect(program[program.length - 1]!.end).toBe(RAM_TOP);
    // Contiguous, so the viewer's derived base still bounds the whole area -
    // which is also why the hi-res pages cannot be coloured `screen`.
    for (let i = 1; i < program.length; i++) {
      expect(program[i]!.start).toBe(program[i - 1]!.end + 1);
    }
    // HGR and HGR2 draw here, and nothing reserves the memory for them: the
    // note is where that trap is named, not the colour.
    expect(at(HIRES_PAGE1).kind).toBe('program');
    expect(at(HIRES_PAGE1).label).toBe('Hi-res page 1');
    expect(at(HIRES_PAGE1).note).toMatch(/HIMEM: 8192/);
    expect(at(HIRES_PAGE2).kind).toBe('program');
  });

  it('starts the program region where the block linter says the program does', () => {
    // The pair the shared battery checks for a registered dialect: the viewer
    // derives its POKE base from the first `program` region, and the linter
    // warns about collisions against `programArea`. Two answers here would put
    // the warning and the picture in different places.
    const program = regions.find((r) => r.kind === 'program')!;
    // One byte apart, which is the zero link the shared battery's
    // LINK_BYTE_OFFSET grants this interpreter family and nothing more.
    expect(apple2plusMemoryBlocks.programArea(0).start).toBe(program.start + 1);
    expect(apple2plusMemoryBlocks.programArea(0).end).toBe(DEFAULT_MEMSIZ - 1);
  });

  it('keeps the block window in the one page the workspace does not claim', () => {
    const program = regions.find((r) => r.kind === 'program')!;
    for (const range of apple2plusMemoryBlocks.validRanges) {
      expect(range.start).toBeGreaterThan(0x02ff);
      expect(range.end).toBeLessThan(program.start);
      // And clear of the screen, which sits between the window and the
      // workspace.
      expect(range.end).toBeLessThan(TEXT_PAGE1);
    }
    // The reserved sub-range is exactly the leaf the map calls firmware
    // vectors, so the linter's warning and the map's note describe one thing.
    const vectors = at(0x03f2);
    expect(apple2plusMemoryBlocks.reservedRanges).toEqual([
      { start: vectors.start, end: vectors.end },
    ]);
    // Sixteen bytes, not the sibling's eight: SOFTEV and PWREDUP are the
    // Autostart Monitor's and the II has neither.
    expect(vectors.end - vectors.start + 1).toBe(16);
    expect(at(apple2plusMemoryBlocks.defaultAddress).label).toBe('Free RAM');
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
    expect(at(0xc056).label).toBe('Display switches');
    expect(at(0xc064).label).toBe('Game connector inputs');
    expect(at(0xc070).label).toBe('Paddle trigger');
    // Card space above the switches, and empty on this machine.
    expect(at(0xc100).kind).toBe('reserved');
    expect(at(IO_TOP).kind).toBe('reserved');
  });

  it('splits the ROM window in two, with no socket left over', () => {
    // 10K of Applesoft in five sockets and then the monitor: no Programmer's
    // Aid and no unpopulated half, which is where the sibling's window has
    // both. The whole window is ROM.
    const window = regions.filter((r) => r.start >= ROM_BASE);
    expect(window.every((r) => r.kind === 'rom')).toBe(true);
    expect(window[0]!.start).toBe(ROM_BASE);
    const basic = at(BASIC_BASE);
    expect([basic.start, basic.end, basic.label]).toEqual([
      BASIC_BASE,
      BASIC_TOP,
      'Applesoft BASIC',
    ]);
    expect(at(MONITOR_BASE).label).toBe('Autostart Monitor');
    // The reset vector is its own leaf because it is the one word that makes
    // this machine a II Plus rather than a II.
    const vectors = at(0xfffc);
    expect([vectors.start, vectors.end]).toEqual([0xfffa, ROM_TOP]);
    expect(vectors.note).toMatch(/\$FA62/);
  });

  it('opens into sub-regions when zoomed in, rather than being flat', () => {
    const coarse = memoryBands(apple2plusMemoryMap, false).map((b) => b.label);
    const detailed = memoryBands(apple2plusMemoryMap, true).map((b) => b.label);
    expect(coarse).toContain('BASIC workspace');
    expect(coarse).not.toContain('Hi-res page 1');
    expect(detailed).toContain('Hi-res page 1');
    expect(detailed).toContain('Speaker');
    expect(detailed.length).toBeGreaterThan(coarse.length);
  });
});
