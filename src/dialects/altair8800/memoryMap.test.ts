// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { altair8800MemoryMap } from './memoryMap';
import { altair8800MemoryBlocks } from './memoryBlocks';
import {
  BASIC_IMAGE_SIZE,
  PROGRAM_BASE,
  RAM_TOP,
  RESERVED_WORDS_BASE,
  RESERVED_WORDS_END,
} from './addresses';

/**
 * The cross-dialect invariants (contiguity, coverage, one screen region, the
 * program base agreeing with `memoryBlocks`) are checked for every registered
 * dialect in `src/dialects/memoryMap.test.ts`. What is here is the part that is
 * specific to this machine: the two absences that make its map unusual, and the
 * boundaries that have to keep tracking `addresses.ts`.
 */
describe('altair8800MemoryMap', () => {
  const { addressSpace, regions } = altair8800MemoryMap;

  it('covers a 64K address space', () => {
    expect(addressSpace).toBe(0x10000);
  });

  it('has no ROM region, because the interpreter lives in RAM', () => {
    // The Altair had no firmware: 8K BASIC was loaded into RAM and could be
    // POKEd over. Anything labelled `rom` here would draw as read-only memory
    // in the viewer and be a lie about the machine.
    expect(regions.filter((r) => r.kind === 'rom')).toEqual([]);
  });

  it('has no screen or attribute region, because there is no display memory', () => {
    expect(regions.filter((r) => r.kind === 'screen')).toEqual([]);
    expect(regions.filter((r) => r.kind === 'attributes')).toEqual([]);
  });

  it('has no hardware buffers: the whole I/O map is ports, not memory', () => {
    expect(regions.filter((r) => r.kind === 'buffer')).toEqual([]);
  });

  it('bands the interpreter under one collapsible group', () => {
    const basic = regions.filter((r) => r.group === 'Altair 8K BASIC');
    expect(basic.map((r) => r.kind)).toEqual(['system', 'system', 'system']);
    expect(basic[0]!.start).toBe(0x0000);
    expect(basic[basic.length - 1]!.end).toBe(PROGRAM_BASE - 1);
  });

  it('puts the reserved-word table where keywords.ts read it from', () => {
    const table = regions.find((r) => r.label === 'Reserved-word table')!;
    expect(table.start).toBe(RESERVED_WORDS_BASE);
    expect(table.end).toBe(RESERVED_WORDS_END);
  });

  it('starts the program area at TXTTAB and ends it at the top of fitted RAM', () => {
    const program = regions.find((r) => r.kind === 'program')!;
    expect(program.start).toBe(PROGRAM_BASE);
    expect(program.end).toBe(RAM_TOP);
    // The same span the block linter validates against, so a block can never be
    // accepted into memory the map says is not there.
    expect(altair8800MemoryBlocks.validRanges).toEqual([
      { start: program.start, end: program.end },
    ]);
  });

  it('leaves the top of the address space unfitted, for the sizing walk', () => {
    const last = regions[regions.length - 1]!;
    expect(last.kind).toBe('reserved');
    expect(last.start).toBe(RAM_TOP + 1);
    expect(last.end).toBe(0xffff);
  });

  it('starts the program inside the loaded image, not above it', () => {
    // Not a mistake in the map: TXTTAB is below the top of the 8,192-byte
    // image, so program text overwrites the image's tail. Pinned because the
    // "obvious" fix - moving the program base above the image - would put it
    // somewhere the interpreter does not look.
    expect(PROGRAM_BASE).toBeLessThan(BASIC_IMAGE_SIZE);
  });

  it('has no user-defined-graphics area', () => {
    expect(altair8800MemoryMap.udgBase).toBeUndefined();
  });
});
