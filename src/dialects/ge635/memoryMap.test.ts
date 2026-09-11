// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  CHARACTERS_PER_WORD,
  MAX_CONSTANTS,
  USER_WORDS,
  ge635MemoryMap,
} from './memoryMap';
import { MAX_PROGRAM_CHARACTERS, tokenizeProgram } from './tokenizer';
import { GE635_PROFILE } from './profile';
import { Ge635InterpreterMachine } from './machine';

/**
 * This map has one figure in it, so most of what is worth asserting is that
 * the figure is the one the interpreter enforces and that the map says what it
 * is counting. The cross-dialect battery checks contiguity and coverage too,
 * but it walks the registry and so does not reach a dialect the app does not
 * yet offer.
 */
describe('ge635MemoryMap', () => {
  const { addressSpace, regions } = ge635MemoryMap;

  it('covers 8,000 words - and they are words, not bytes', () => {
    // Section 2.9's whole-program budget, and the unit that makes it make
    // sense: four characters to a thirty-six-bit word.
    expect(addressSpace).toBe(8000);
    expect(USER_WORDS).toBe(addressSpace);
    expect(ge635MemoryMap.addressUnit).toBe('word');
    expect(CHARACTERS_PER_WORD).toBe(4);
  });

  it('tiles the whole space with contiguous ascending regions', () => {
    expect(regions[0]!.start).toBe(0);
    expect(regions[regions.length - 1]!.end).toBe(addressSpace - 1);
    for (let i = 1; i < regions.length; i++) {
      expect(
        regions[i]!.start,
        `"${regions[i]!.label}" begins one word after "${regions[i - 1]!.label}" ends`,
      ).toBe(regions[i - 1]!.end + 1);
    }
  });

  it('draws one region, because the manual places nothing inside it', () => {
    // Not an omission. No compiler listing survives for this machine, so
    // section 2.9's total is the only figure there is; a band inside it would
    // be a boundary nobody can cite, drawn as confidently as a read one.
    expect(regions.map((r) => r.label)).toEqual(['User program space']);
    expect(regions[0]!.kind).toBe('program');
    expect(regions[0]!.group).toBeUndefined();
    // The three claims on the space are named where a reader will meet them.
    for (const term of ['program text', 'vector', 'string', 'OUT OF ROOM']) {
      expect(regions[0]!.note, term).toContain(term);
    }
    // Including the one rule the run-time does not enforce, which a reader
    // budgeting a program still has to know about.
    expect(regions[0]!.note).toContain(`${MAX_CONSTANTS} constants`);
    expect(GE635_PROFILE.limits.maxDataConstants).toBeUndefined();
  });

  it('has no ROM, screen or buffer region, none of them existing', () => {
    // The compiler is read in from disc, output went to a teletype on a serial
    // channel, and nothing in the user's 8,000 words is hardware.
    for (const kind of ['rom', 'screen', 'attributes', 'buffer'] as const) {
      expect(regions.filter((r) => r.kind === kind)).toEqual([]);
    }
  });

  it('has no user-defined-graphics area', () => {
    expect(ge635MemoryMap.udgBase).toBeUndefined();
  });

  it('agrees with the budget the interpreter enforces', () => {
    // The map and the machine cannot drift apart without this failing: the
    // profile's ceiling is what `OUT OF ROOM` is measured against.
    expect(GE635_PROFILE.limits.maxProgramWords).toBe(addressSpace);
    // And the character ceiling is that budget spent entirely on program text,
    // one word short of the strict inequality.
    expect(MAX_PROGRAM_CHARACTERS).toBe(addressSpace * CHARACTERS_PER_WORD - 1);
  });

  it('answers OUT OF ROOM for a program past the budget', () => {
    // Read off the running machine rather than the constant: a program whose
    // characters alone spend the 8,000 words never starts.
    const filler = 'X'.repeat(240);
    const lines = [];
    for (let n = 10; n <= 1500; n += 10) {
      lines.push(`${n} REM ${filler}`);
    }
    lines.push(`${(lines.length + 1) * 10} END`);
    const source = `${lines.join('\n')}\n`;
    expect(source.length).toBeGreaterThan(addressSpace * CHARACTERS_PER_WORD);

    const machine = new Ge635InterpreterMachine();
    machine.loadProgram(tokenizeProgram(source).image);
    for (let i = 0; i < 3000 && machine.isProgramRunning(); i++) {
      machine.runFrame();
    }
    expect(machine.interpreter.terminal.text()).toContain('OUT OF ROOM');
  });
});
