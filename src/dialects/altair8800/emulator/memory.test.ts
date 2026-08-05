// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { BASIC_BASE, RAM_TOP } from '../addresses';
import { Altair8800Memory } from './memory';

describe('altair8800 memory', () => {
  it('copies the interpreter into RAM at 0x0000, where a POKE can reach it', () => {
    const memory = new Altair8800Memory();
    memory.loadInterpreter(Uint8Array.from([0xc3, 0x00, 0x10]));

    expect(memory.read(BASIC_BASE)).toBe(0xc3);
    expect(memory.read(BASIC_BASE + 2)).toBe(0x10);

    // There is no ROM here: the interpreter is in writable RAM, exactly as it
    // was when it arrived from paper tape.
    memory.write(BASIC_BASE, 0x00);
    expect(memory.read(BASIC_BASE)).toBe(0x00);
  });

  it('starts from a clean 64K each time an image is loaded', () => {
    const memory = new Altair8800Memory();
    memory.write(0x2000, 0x55);
    memory.loadInterpreter(new Uint8Array(0));
    expect(memory.read(0x2000)).toBe(0x00);
  });

  it('floats high above the fitted memory, so BASIC can find the top', () => {
    const memory = new Altair8800Memory();
    expect(memory.ramTop).toBe(RAM_TOP);

    memory.write(RAM_TOP, 0x42);
    expect(memory.read(RAM_TOP)).toBe(0x42);

    memory.write(RAM_TOP + 1, 0x42);
    expect(memory.read(RAM_TOP + 1)).toBe(0xff);
    expect(memory.read(0xffff)).toBe(0xff);
  });

  it('fits the same 48K whatever the IDE asks for', () => {
    // The IDE's 16/32/64K RAM setting describes a machine sold in one size with
    // an expansion option. An S-100 backplane held whatever boards its owner
    // bought, so this dialect commits to the one configuration `addresses.ts`
    // documents - the one `programRamBytes` and the memory map describe - and
    // takes no RAM argument at all.
    expect(new Altair8800Memory().ramTop).toBe(RAM_TOP);
  });

  it('wraps addresses into the 16-bit space', () => {
    const memory = new Altair8800Memory();
    memory.write(0x10000 + 0x0100, 0x7e);
    expect(memory.read(0x0100)).toBe(0x7e);
  });

  it('reads and writes little-endian words', () => {
    const memory = new Altair8800Memory();
    memory.writeWord(0x0200, 0x1939);
    expect(memory.read(0x0200)).toBe(0x39);
    expect(memory.read(0x0201)).toBe(0x19);
    expect(memory.readWord(0x0200)).toBe(0x1939);
  });
});
