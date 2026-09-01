// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  COMMON_TABLES,
  CORE_WORDS,
  DATA_REGION,
  DATA_REGION_WORDS,
  LINE_TABLE_WORDS,
  PROGRAM_AREA,
  RETURN_STACK_WORDS,
  RUNTIME_WORK,
  SAVE_AREA,
  SYMBOL_TABLE,
  USER_AREA,
  ge235MemoryMap,
} from './memoryMap';
import { MAX_LINES } from './tokenizer';
import { MAX_DATA_CONSTANTS, MAX_GOSUB_DEPTH } from './interpreter/interpreter';

/**
 * The map is arithmetic over the compiler's own allocation table, so most of
 * what is worth asserting is that the arithmetic still lands on the addresses
 * the listing writes down, and that the limits falling out of it are the limits
 * the interpreter enforces.
 *
 * Contiguity and coverage are checked here as well as in the cross-dialect
 * battery, which walks the registry and so does not reach a dialect the app
 * does not yet offer.
 */
describe('ge235MemoryMap', () => {
  const { addressSpace, regions } = ge235MemoryMap;

  it('covers 8,192 words - and they are words, not bytes', () => {
    // The store is twenty bits wide and addressed a word at a time. 0o20000 is
    // the top of what one instruction's thirteen-bit address field reaches,
    // which the listing calls the top of lower memory.
    expect(addressSpace).toBe(0o20000);
    expect(addressSpace).toBe(8192);
    expect(CORE_WORDS).toBe(addressSpace);
  });

  it('tiles the whole store with contiguous ascending regions', () => {
    expect(regions[0]!.start).toBe(0);
    expect(regions[regions.length - 1]!.end).toBe(addressSpace - 1);
    for (let i = 1; i < regions.length; i++) {
      expect(
        regions[i]!.start,
        `"${regions[i]!.label}" begins one word after "${regions[i - 1]!.label}" ends`,
      ).toBe(regions[i - 1]!.end + 1);
    }
  });

  it('lands every boundary on the address the listing gives it', () => {
    const starts = Object.fromEntries(regions.map((r) => [r.label, r.start]));
    expect(starts['BASIC run-time']).toBe(0o1400);
    expect(starts['Save area']).toBe(0o4000);
    expect(starts['Compiler workspace']).toBe(0o4100);
    expect(starts['Variables and symbol table']).toBe(0o17326);
    expect(regions[regions.length - 1]!.end).toBe(0o17777);
  });

  it('fills the run-time block exactly, from its base to the save area', () => {
    // The executive is told to move 1280 words to `work`, and the save area is
    // the next thing allocated: a gap either way would mean one of the two
    // figures is wrong.
    expect(SAVE_AREA - RUNTIME_WORK).toBe(1280);
  });

  it('keeps the save area to one 64-word disk record', () => {
    expect(USER_AREA - SAVE_AREA).toBe(64);
  });

  it('lands the DATA region on a disk-record boundary', () => {
    // The compiler reserves 22 words it never uses to make this true, and says
    // so. Getting the chain of reservations above it wrong by any amount would
    // show up here rather than silently shifting every region above.
    expect(DATA_REGION % 64).toBe(0);
    expect(DATA_REGION).toBeGreaterThan(COMMON_TABLES);
    expect(DATA_REGION + DATA_REGION_WORDS).toBeLessThanOrEqual(PROGRAM_AREA);
  });

  it('agrees with the limits the interpreter enforces', () => {
    // Each of these is a table's size divided by what one entry costs, so the
    // map and the machine cannot drift apart without one of them failing here.
    expect(LINE_TABLE_WORDS / 2).toBe(MAX_LINES);
    expect(DATA_REGION_WORDS / 2).toBe(MAX_DATA_CONSTANTS);
    expect(RETURN_STACK_WORDS).toBe(MAX_GOSUB_DEPTH);
  });

  it('has no ROM region, because the machine is core store throughout', () => {
    // Nothing here is read-only: the compiler is read in from disk into
    // writable core, exactly as the Altair's interpreter is.
    expect(regions.filter((r) => r.kind === 'rom')).toEqual([]);
  });

  it('has no screen or attribute region, because there is no display', () => {
    // Output went to a teletype on a serial channel. A `screen` region here
    // would draw display memory the machine never had.
    expect(regions.filter((r) => r.kind === 'screen')).toEqual([]);
    expect(regions.filter((r) => r.kind === 'attributes')).toEqual([]);
  });

  it('keeps the program area in one run, from the object base to the top', () => {
    const program = regions.filter((r) => r.kind === 'program');
    expect(program.map((r) => r.label)).toEqual([
      'Object program',
      'Variables and symbol table',
    ]);
    expect(program[0]!.start).toBe(PROGRAM_AREA);
    expect(program[1]!.start).toBe(SYMBOL_TABLE);
    expect(program[1]!.end).toBe(addressSpace - 1);
    // Contiguous: the compiled program, its variables and the symbol table are
    // one span the compiler fills from both ends.
    expect(program[1]!.start).toBe(program[0]!.end + 1);
  });

  it('bands the executive and the user area under collapsible groups', () => {
    const groups = regions.map((r) => r.group);
    expect(groups.filter((g) => g === 'Time-sharing executive')).toHaveLength(
      3,
    );
    expect(
      groups.filter((g) => g === 'Compiler and run-time workspace'),
    ).toHaveLength(2);
    expect(groups.filter((g) => g === 'User program area')).toHaveLength(2);
    // The two ungrouped regions stand alone at every zoom level.
    expect(
      regions.filter((r) => r.group === undefined).map((r) => r.label),
    ).toEqual(['BASIC run-time', 'Save area']);
  });

  it('has no user-defined-graphics area', () => {
    expect(ge235MemoryMap.udgBase).toBeUndefined();
  });
});
