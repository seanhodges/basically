// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { Apple1Memory } from './memory';
import { Apple1Pia, ORB } from './pia';
import {
  BASIC_BASE,
  BASIC_TOP,
  DSPCR,
  FIRMWARE_BYTES,
  KBD,
  KBDCR,
  MONITOR_BASE,
  MONITOR_BYTES,
  RAM_TOP,
} from '../../dialects/apple1/addresses';

/** A firmware image whose two halves are told apart by their fill byte. */
function firmware(): Uint8Array {
  const rom = new Uint8Array(FIRMWARE_BYTES);
  rom.fill(0x11, 0, MONITOR_BYTES);
  rom.fill(0x22, MONITOR_BYTES);
  return rom;
}

function harness() {
  let keyLatch = 0x80;
  const written: number[] = [];
  const pia = new Apple1Pia({
    readPortA: () => keyLatch,
    readPortB: () => 0,
    writePortB: (v) => written.push(v),
  });
  const memory = new Apple1Memory(pia);
  memory.loadFirmware(firmware());
  // Put the PIA in the state the monitor leaves it in, so the data registers
  // rather than the direction registers answer.
  memory.write(ORB, 0x7f); // DDRB, while the control registers are still clear
  memory.write(DSPCR, 0xa7);
  memory.write(KBDCR, 0xa7);
  return {
    memory,
    pia,
    written,
    setKey: (code: number) => {
      keyLatch = code | 0x80;
      pia.strobeKey();
    },
  };
}

describe('apple1 memory', () => {
  it('lays the one image into the two places its halves belong', () => {
    const { memory } = harness();
    expect(memory.read(MONITOR_BASE)).toBe(0x11);
    expect(memory.read(0xffff)).toBe(0x11);
    expect(memory.read(BASIC_BASE)).toBe(0x22);
    expect(memory.read(BASIC_TOP)).toBe(0x22);
  });

  it('has 4K of RAM on the board and RAM where the interpreter sits', () => {
    const { memory } = harness();
    memory.write(0x0000, 0x5a);
    memory.write(RAM_TOP, 0x5b);
    expect([memory.read(0x0000), memory.read(RAM_TOP)]).toEqual([0x5a, 0x5b]);

    // Integer BASIC arrived on tape rather than in a chip, so its block is RAM
    // and a program really can overwrite it.
    memory.write(BASIC_BASE, 0x33);
    expect(memory.read(BASIC_BASE)).toBe(0x33);
  });

  it('ignores writes to the monitor PROM', () => {
    const { memory } = harness();
    memory.write(MONITOR_BASE, 0x99);
    expect(memory.read(MONITOR_BASE)).toBe(0x11);
  });

  it('reads the unfitted map as a floating bus', () => {
    const { memory } = harness();
    for (const address of [0x1000, 0x8000, 0xc100, 0xf000, 0xfeff]) {
      memory.write(address, 0x5a);
      expect(memory.read(address)).toBe(0xff);
    }
  });

  it('repeats the PIA across the whole of its page', () => {
    const h = harness();
    h.setKey(0x41);
    // A4 selects the chip and A0/A1 its four registers; nothing else in the
    // page is decoded, so all of these are the same two cells.
    for (const kbd of [KBD, 0xd014, 0xd110, 0xd9f0]) {
      expect(h.memory.read(kbd + 1) & 0x80).toBe(0x80); // KBDCR: key waiting
      expect(h.memory.read(kbd)).toBe(0xc1);
      expect(h.memory.read(kbd + 1) & 0x80).toBe(0); // taken by that read
      h.setKey(0x41);
    }
    // A4 clear is not the PIA at all: open bus, and no character sent.
    h.memory.write(0xd002, 0xc1);
    expect(h.memory.read(0xd002)).toBe(0xff);
    expect(h.written).toEqual([]);
  });

  it('peeks the PIA without taking the key', () => {
    const h = harness();
    h.setKey(0x41);
    expect(h.memory.peek(KBD)).toBe(0xc1);
    expect(h.memory.peek(KBDCR) & 0x80).toBe(0x80);
    expect(h.pia.keyWaiting).toBe(true);
  });

  it('reads pointers little-endian, on and off the bus', () => {
    const { memory } = harness();
    memory.write(0x004a, 0x00);
    memory.write(0x004b, 0x08);
    expect(memory.readWord(0x004a)).toBe(0x0800);
    expect(memory.peekWord(0x004a)).toBe(0x0800);
  });

  it('leaves the interpreter block padded when the image is monitor-only', () => {
    let keyLatch = 0x80;
    const pia = new Apple1Pia({
      readPortA: () => keyLatch,
      readPortB: () => 0,
      writePortB: () => {
        keyLatch = 0x80;
      },
    });
    const memory = new Apple1Memory(pia);
    const short = new Uint8Array(FIRMWARE_BYTES).fill(0xff);
    short.fill(0x11, 0, MONITOR_BYTES);
    memory.loadFirmware(short);
    expect(memory.read(BASIC_BASE)).toBe(0xff);
    expect(memory.read(MONITOR_BASE)).toBe(0x11);
  });
});
