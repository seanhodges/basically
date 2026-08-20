// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { MONITOR_SIZE } from '../romImage';
import { OPEN_BUS, Pmd85Memory } from './memory';
import { VIDEO_RAM_BASE, VIDEO_RAM_BYTES } from './display';

/** A Monitor image whose every byte says which offset it came from. */
function markedMonitor(): Uint8Array {
  const rom = new Uint8Array(MONITOR_SIZE);
  for (let i = 0; i < rom.length; i++) rom[i] = i & 0xff;
  rom[0] = 0x31; // the real Monitor's first byte, LD SP,...
  return rom;
}

describe('pmd85 memory', () => {
  it('mirrors the Monitor over the bottom of the map until the first OUT', () => {
    const memory = new Pmd85Memory(markedMonitor());

    // The CPU starts at 0x0000 and has to find firmware there: an 8080 has no
    // other reset address, and the machine has no ROM at 0x0000 of its own.
    expect(memory.read(0x0000)).toBe(0x31);
    expect(memory.read(0x0123)).toBe(memory.read(0x8123));
    expect(memory.read(0x2123)).toBe(memory.read(0x8123));
    // The two 4K gaps between the mirrors have nothing behind them.
    expect(memory.read(0x1000)).toBe(OPEN_BUS);
    expect(memory.read(0x3fff)).toBe(OPEN_BUS);

    memory.leaveStartupMap();

    expect(memory.read(0x0000)).toBe(0x00);
    expect(memory.read(0x1000)).toBe(0x00);
    expect(memory.read(0x8123)).toBe(0x23);
  });

  it('answers 0x4000-0x7FFF as video RAM in the startup map, and as RAM after', () => {
    const memory = new Pmd85Memory(markedMonitor());

    // The Monitor clears the screen before it has any addressable RAM, through
    // this mirror.
    memory.write(0x4000, 0xaa);
    memory.write(0x7fff, 0x55);
    expect(memory.read(VIDEO_RAM_BASE)).toBe(0xaa);
    expect(memory.read(VIDEO_RAM_BASE + 0x3fff)).toBe(0x55);

    memory.leaveStartupMap();

    memory.write(0x4000, 0x11);
    expect(memory.read(0x4000)).toBe(0x11);
    expect(memory.read(VIDEO_RAM_BASE)).toBe(0xaa);
  });

  it('refuses writes to the ROM in both configurations', () => {
    const memory = new Pmd85Memory(markedMonitor());

    memory.write(0x0000, 0xff); // the mirror is ROM, not RAM
    expect(memory.read(0x0000)).toBe(0x31);

    memory.leaveStartupMap();
    memory.write(0x8123, 0xff);
    memory.write(0xa123, 0xff);
    expect(memory.read(0x8123)).toBe(0x23);
    expect(memory.read(0xa123)).toBe(0x23);
  });

  it('lays the normal map out with its two holes', () => {
    const memory = new Pmd85Memory(markedMonitor());
    memory.leaveStartupMap();

    for (const address of [0x0000, 0x7fff]) {
      memory.write(address, 0x42);
      expect(memory.read(address), address.toString(16)).toBe(0x42);
    }
    // The Monitor and its mirror.
    expect(memory.read(0x8fff)).toBe(0xff);
    expect(memory.read(0xafff)).toBe(0xff);
    // The gaps either side of it: nothing is decoded there at all.
    expect(memory.read(0x9000)).toBe(OPEN_BUS);
    expect(memory.read(0xb000)).toBe(OPEN_BUS);
    memory.write(0x9000, 0x42);
    expect(memory.read(0x9000)).toBe(OPEN_BUS);
  });

  it('exposes video RAM as a live view of the top 16K', () => {
    const memory = new Pmd85Memory(markedMonitor());
    memory.leaveStartupMap();

    expect(memory.videoRam).toHaveLength(VIDEO_RAM_BYTES);
    memory.write(0xc000 + 0x40 * 5 + 7, 0x3f);
    expect(memory.videoRam[0x40 * 5 + 7]).toBe(0x3f);
  });

  it('reads a missing Monitor as open bus rather than throwing', () => {
    const memory = new Pmd85Memory(new Uint8Array(0));
    expect(memory.read(0x0000)).toBe(OPEN_BUS);
    memory.leaveStartupMap();
    expect(memory.read(0x8000)).toBe(OPEN_BUS);
  });

  it('returns to the startup map, and clears RAM, on reset', () => {
    const memory = new Pmd85Memory(markedMonitor());
    memory.leaveStartupMap();
    memory.write(0x1234, 0x99);
    memory.write(0xc000, 0x99);

    memory.reset();

    expect(memory.inStartupMap).toBe(true);
    expect(memory.videoRam[0]).toBe(0x00);
    memory.leaveStartupMap();
    expect(memory.read(0x1234)).toBe(0x00);
  });
});
