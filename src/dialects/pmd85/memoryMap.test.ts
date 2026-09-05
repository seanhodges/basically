// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pmd85MemoryMap } from './memoryMap';
import { pmd85MemoryBlocks } from './memoryBlocks';
import { splitRomImage } from './romImage';
import { tokenizeProgram } from './tokenizer';
import { Pmd85Machine } from './emulator/pmd85Machine';
import {
  BASIC_BASE,
  PROGRAM_BASE,
  STACK_TOP,
  STRING_TOP,
  USER_CODE_BASE,
} from './addresses';
import { MONITOR_BASE, MONITOR_MIRROR_BASE } from './emulator/memory';
import { VIDEO_RAM_BASE } from './emulator/display';

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/pmd85/pmd85.rom')),
);

const regions = pmd85MemoryMap.regions;
const at = (address: number) =>
  regions.find((r) => address >= r.start && address <= r.end);

describe('pmd85 memory map', () => {
  it('places the Monitor at 8000h, its mirror at A000h and video RAM at C000h', () => {
    expect(at(MONITOR_BASE)?.kind).toBe('rom');
    expect(at(MONITOR_MIRROR_BASE)?.label).toContain('mirror');
    expect(at(VIDEO_RAM_BASE)?.kind).toBe('screen');
    expect(at(0xffff)?.kind).toBe('screen');
  });

  it('leaves the decoder’s two holes unmapped', () => {
    // The pair either side of the Monitor. Nothing drives the bus in them, so
    // drawing them as RAM would invite a POKE that vanishes.
    expect(at(0x9000)?.kind).toBe('reserved');
    expect(at(0xb000)?.kind).toBe('reserved');
  });

  it('shows the interpreter as writable RAM, not as ROM', () => {
    // The distinction that makes this machine unusual: BASIC-G is a copy in
    // RAM, so a stray POKE really does reach it.
    expect(at(BASIC_BASE)?.kind).toBe('system');
    expect(at(BASIC_BASE)?.group).toBe('BASIC-G V2.0');
  });

  it('bounds the program area where BASIC-G’s own pointers do', () => {
    const program = regions.find((r) => r.kind === 'program')!;
    expect(program.start).toBe(PROGRAM_BASE);
    expect(program.end).toBe(STACK_TOP);
  });

  it('agrees with the running machine about where the program went', () => {
    // The map is only worth drawing if it describes the machine: a program is
    // loaded and its first byte looked for at the address the map claims.
    const pmd = new Pmd85Machine(splitRomImage(rom));
    const { program } = tokenizeProgram('10 END\n');
    pmd.loadProgram(program);
    const region = at(PROGRAM_BASE)!;
    expect(region.kind).toBe('program');
    expect(pmd.mem.read(PROGRAM_BASE)).toBe(program[0]);
  });
});

describe('pmd85 memory blocks', () => {
  it('keeps valid ranges clear of the interpreter, the workspace and video RAM', () => {
    const valid = (address: number) =>
      pmd85MemoryBlocks.validRanges.some(
        (r) => address >= r.start && address <= r.end,
      );
    for (const address of [
      BASIC_BASE, // the interpreter
      0x5e00, // BASIC-G's workspace
      0x6000, // string space
      MONITOR_BASE,
      VIDEO_RAM_BASE,
    ]) {
      expect(valid(address), `0x${address.toString(16)}`).toBe(false);
    }
    expect(valid(PROGRAM_BASE)).toBe(true);
    expect(valid(STRING_TOP)).toBe(true);
    expect(valid(USER_CODE_BASE - 1)).toBe(true);
  });

  it('round-trips a code block through loadProgram', () => {
    const pmd = new Pmd85Machine(splitRomImage(rom));
    const address = pmd85MemoryBlocks.defaultAddress;
    const bytes = Uint8Array.of(0x3e, 0x2a, 0xc9); // LD A,'*' / RET
    pmd.loadProgram(tokenizeProgram('10 END\n').program, {
      blocks: [{ address, bytes }],
    });
    for (let i = 0; i < bytes.length; i++) {
      expect(pmd.mem.read(address + i)).toBe(bytes[i]);
    }
  });

  it('grows the program area with the program', () => {
    const small = pmd85MemoryBlocks.programArea(0);
    const large = pmd85MemoryBlocks.programArea(1000);
    expect(small.start).toBe(PROGRAM_BASE);
    expect(large.end - small.end).toBe(1000);
    expect(large.end).toBeLessThan(STACK_TOP);
  });
});
