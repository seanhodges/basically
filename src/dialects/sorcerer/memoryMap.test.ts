// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Sorcerer's own memory-map checks. The cross-dialect invariants - tiling,
 * one screen region, groups collapsing unambiguously - live in
 * `src/dialects/memoryMap.test.ts` and start applying the moment the dialect
 * registers; what is here is the machine-specific half those cannot know, and
 * a copy of the tiling rule so the map is held to it before that day.
 */
import { describe, expect, it } from 'vitest';
import { sorcererMemoryMap } from './memoryMap';
import { sorcererMemoryBlocks } from './memoryBlocks';
import {
  BASIC_MEMORY_TOP,
  CHARGEN_RAM_BASE,
  CHARGEN_ROM_BASE,
  MONITOR_BASE,
  MONITOR_WORKAREA_BASE,
  PROGRAM_BASE,
  RAM_FITTED_BYTES,
  ROM_PAC_BASE,
  SCREEN_BASE,
  SCREEN_COLUMNS,
  SCREEN_ROWS,
} from './addresses';

const { regions, addressSpace } = sorcererMemoryMap;

const regionAt = (addr: number) =>
  regions.find((r) => addr >= r.start && addr <= r.end)!;

describe('sorcerer memory map', () => {
  it('tiles the whole 64K address space', () => {
    expect(addressSpace).toBe(0x10000);
    expect(regions[0]!.start).toBe(0);
    expect(regions.at(-1)!.end).toBe(addressSpace - 1);
    for (let i = 1; i < regions.length; i++) {
      expect(
        regions[i]!.start,
        `"${regions[i]!.label}" follows "${regions[i - 1]!.label}"`,
      ).toBe(regions[i - 1]!.end + 1);
    }
  });

  it('names the screen RAM, both generator halves and the ROM PAC', () => {
    const screen = regionAt(SCREEN_BASE);
    expect(screen.kind).toBe('screen');
    expect(screen.start).toBe(SCREEN_BASE);
    // One byte per cell and no attributes, so the region is exactly the grid.
    expect(screen.end - screen.start + 1).toBe(SCREEN_COLUMNS * SCREEN_ROWS);

    // The generator is the machine's oddity: half of it cannot be written and
    // half of it is ordinary RAM, and the map has to say which is which or a
    // reader learns the opposite of the truth about redefining a character.
    expect(regionAt(CHARGEN_ROM_BASE).kind).toBe('rom');
    expect(regionAt(CHARGEN_RAM_BASE).kind).not.toBe('rom');
    expect(regionAt(CHARGEN_ROM_BASE).group).toBe(
      regionAt(CHARGEN_RAM_BASE).group,
    );

    expect(regionAt(ROM_PAC_BASE).kind).toBe('rom');
    expect(regionAt(ROM_PAC_BASE).end).toBe(MONITOR_BASE - 1);
    expect(regionAt(MONITOR_BASE).kind).toBe('rom');
    expect(regionAt(MONITOR_WORKAREA_BASE).kind).toBe('system');
  });

  it('agrees with memoryBlocks.programArea on the program region', () => {
    const program = regions.filter((r) => r.kind === 'program');
    expect(program).toHaveLength(1);
    expect(program[0]!.start).toBe(sorcererMemoryBlocks.programArea(0).start);
    expect(program[0]!.start).toBe(PROGRAM_BASE);
    // And the same ceiling the block linter refuses to place code above.
    expect(program[0]!.end).toBe(sorcererMemoryBlocks.validRanges[0]!.end);
  });

  it('stops BASIC’s RAM a page below the top of the fitted 32K', () => {
    // The ROM PAC's cold start reserves that page for the Monitor, so the map
    // has two more regions above the program area before the bus goes empty -
    // not one run of RAM to 0x7FFF.
    expect(regionAt(BASIC_MEMORY_TOP).kind).toBe('program');
    expect(regionAt(BASIC_MEMORY_TOP + 1).kind).toBe('system');
    expect(regionAt(RAM_FITTED_BYTES - 1).kind).toBe('system');
    expect(regionAt(BASIC_MEMORY_TOP + 1).group).toBe(
      regionAt(RAM_FITTED_BYTES - 1).group,
    );
  });

  it('draws the unpopulated span as reserved, which is what sizes the RAM', () => {
    const empty = regionAt(RAM_FITTED_BYTES);
    expect(empty.kind).toBe('reserved');
    expect(empty.end).toBe(ROM_PAC_BASE - 1);
  });

  it('offers no UDG base: USR here is the machine-code call', () => {
    // The field exists for `POKE USR "a"`, which this BASIC cannot say. A
    // program redefines a character by poking generator RAM at an address it
    // works out itself, so there is nothing for the POKE resolver to anchor.
    expect(sorcererMemoryMap.udgBase).toBeUndefined();
  });
});
