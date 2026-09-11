// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { hasFirmware, OPEN_BUS, SCREEN_BYTES, SorcererMemory } from './memory';
import {
  CHARGEN_RAM_BASE,
  CHARGEN_ROM_BASE,
  CHARGEN_ROM_SIZE,
  MONITOR_BASE,
  MONITOR_SIZE,
  MONITOR_WORKAREA_BASE,
  RAM_FITTED_BYTES,
  ROM_PAC_BASE,
  ROM_PAC_SIZE,
  SCREEN_BASE,
} from '../../dialects/sorcerer/addresses';
import { READ_BIT, WRITE_BIT } from '../memoryActivityBuffer';

/**
 * Distinguishable stand-ins for the three ROMs, so a read that lands in the
 * wrong device is a wrong *value* rather than a plausible one.
 */
function parts() {
  return {
    monitor: new Uint8Array(MONITOR_SIZE).fill(0x11),
    romPac: new Uint8Array(ROM_PAC_SIZE).fill(0x22),
    charGen: new Uint8Array(CHARGEN_ROM_SIZE).fill(0x33),
  };
}

/** A bus past the boot mirror, which is where all but the first test wants it. */
function running(): SorcererMemory {
  const memory = new SorcererMemory(parts());
  memory.peek(MONITOR_BASE);
  return memory;
}

describe('SorcererMemory', () => {
  it('mirrors the Monitor over the bottom of memory until the CPU reaches it', () => {
    const memory = new SorcererMemory(parts());
    expect(memory.inBootMirror).toBe(true);
    expect(memory.peek(0x0000)).toBe(0x11);

    // A write through the mirror still lands in the RAM underneath it: that RAM
    // is what the Monitor's memory sizing is writing to, and a write the mirror
    // swallowed would have the machine decide it has none.
    memory.write(0x0000, 0x5a);
    expect(memory.peek(0x0000)).toBe(0x11);

    // Reaching the Monitor's own window is what drops the mirror - on the real
    // machine, the opening jump's own destination fetch.
    expect(memory.peek(MONITOR_BASE)).toBe(0x11);
    expect(memory.inBootMirror).toBe(false);
    expect(memory.peek(0x0000)).toBe(0x5a);
  });

  it('answers each window with its own device', () => {
    const memory = running();
    expect(memory.peek(RAM_FITTED_BYTES - 1)).toBe(0x00);
    expect(memory.peek(ROM_PAC_BASE)).toBe(0x22);
    expect(memory.peek(ROM_PAC_BASE + ROM_PAC_SIZE - 1)).toBe(0x22);
    expect(memory.peek(MONITOR_BASE)).toBe(0x11);
    expect(memory.peek(CHARGEN_ROM_BASE)).toBe(0x33);
    expect(memory.peek(CHARGEN_RAM_BASE)).toBe(0x00);
  });

  /**
   * The unpopulated span above fitted RAM is the one the Monitor's cold start
   * depends on: it walks up from address zero writing and reading back, and a
   * span that behaved as RAM would have a 32K machine size itself at 48K and
   * put its stack where no chip holds it.
   */
  it('leaves the space above fitted RAM undriven and unwritable', () => {
    const memory = running();
    expect(memory.peek(RAM_FITTED_BYTES)).toBe(OPEN_BUS);
    memory.write(RAM_FITTED_BYTES, 0x00);
    expect(memory.peek(RAM_FITTED_BYTES)).toBe(OPEN_BUS);
  });

  it('takes no writes to either ROM window', () => {
    const memory = running();
    memory.write(ROM_PAC_BASE, 0xff);
    memory.write(MONITOR_BASE, 0xff);
    memory.write(CHARGEN_ROM_BASE, 0xff);
    expect(memory.peek(ROM_PAC_BASE)).toBe(0x22);
    expect(memory.peek(MONITOR_BASE)).toBe(0x11);
    expect(memory.peek(CHARGEN_ROM_BASE)).toBe(0x33);
  });

  it('takes writes to the workarea, the screen and generator RAM', () => {
    const memory = running();
    for (const address of [
      MONITOR_WORKAREA_BASE,
      SCREEN_BASE,
      CHARGEN_RAM_BASE,
      0xffff,
    ]) {
      memory.write(address, 0x7e);
      expect(memory.peek(address)).toBe(0x7e);
    }
  });

  it('views screen and generator RAM without going through the bus', () => {
    const memory = running();
    expect(memory.screenRam.length).toBe(SCREEN_BYTES);
    expect(memory.charGenRam.length).toBe(0x400);
    memory.write(SCREEN_BASE + 5, 0x41);
    expect(memory.screenRam[5]).toBe(0x41);
    memory.write(CHARGEN_RAM_BASE + 3, 0x99);
    expect(memory.charGenRam[3]).toBe(0x99);
  });

  it('reads and writes little-endian words', () => {
    const memory = running();
    memory.writeWord(0x0100, 0xbeef);
    expect(memory.peek(0x0100)).toBe(0xef);
    expect(memory.peek(0x0101)).toBe(0xbe);
    expect(memory.readWord(0x0100)).toBe(0xbeef);
    expect(memory.rawReadWord(0x0100)).toBe(0xbeef);
  });

  /**
   * The half that is easy to miss: the host's own introspection must read
   * through a path that records nothing, or the memory-map overlay reports the
   * IDE's polling as the program's own accesses.
   */
  it('records activity on the CPU path and not on the host path', () => {
    const memory = running();
    memory.activity.enabled = true;
    memory.read(0x0200);
    memory.write(0x0201, 1);
    memory.peek(0x0202);
    memory.poke(0x0203, 1);
    memory.rawReadWord(0x0204);
    const hits = memory.activity.drain();
    expect(hits[0x0200]).toBe(READ_BIT);
    expect(hits[0x0201]).toBe(WRITE_BIT);
    expect(hits[0x0202]).toBe(0);
    expect(hits[0x0203]).toBe(0);
    expect(hits[0x0204]).toBe(0);
  });

  it('clears RAM and re-mirrors the Monitor on reset', () => {
    const memory = running();
    memory.write(0x0100, 0x42);
    memory.reset();
    expect(memory.inBootMirror).toBe(true);
    expect(memory.peek(MONITOR_BASE)).toBe(0x11);
    expect(memory.peek(0x0100)).toBe(0x00);
  });

  it('knows a short image from a whole one', () => {
    expect(hasFirmware(parts())).toBe(true);
    expect(hasFirmware({ ...parts(), charGen: new Uint8Array(0) })).toBe(false);
    expect(hasFirmware({ ...parts(), romPac: new Uint8Array(4) })).toBe(false);
  });
});
