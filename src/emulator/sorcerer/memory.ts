// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import {
  MemoryActivityBuffer,
  READ_BIT,
  WRITE_BIT,
} from '../memoryActivityBuffer';
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
  SCREEN_COLUMNS,
  SCREEN_ROWS,
} from '../../dialects/sorcerer/addresses';

/**
 * What an address with nothing behind it reads as.
 *
 * A 32K Sorcerer leaves 0x8000-0xBFFF unpopulated - that is where an expansion
 * chassis or more RAM went - and a TTL bus left floating settles high. This is
 * not an inert detail: the Monitor's cold start finds the top of memory by
 * writing to successive addresses and reading them back, so a machine that let
 * the empty span behave as RAM would size itself at 48K and put its stack where
 * no chip holds it.
 */
export const OPEN_BUS = 0xff;

/** Screen RAM in bytes: one character code per cell, no attributes. */
export const SCREEN_BYTES = SCREEN_COLUMNS * SCREEN_ROWS;

/**
 * The Sorcerer memory bus.
 *
 *   0x0000-0x7FFF  fitted RAM (the 32K machine this dialect models)
 *   0x8000-0xBFFF  unpopulated - open bus
 *   0xC000-0xDFFF  the ROM PAC, Exidy Standard BASIC
 *   0xE000-0xEFFF  the Monitor ROM
 *   0xF000-0xF07F  the Monitor's workarea and system variables (RAM)
 *   0xF080-0xF7FF  screen RAM, 64x30 character codes
 *   0xF800-0xFBFF  the character generator ROM, codes 0-127
 *   0xFC00-0xFFFF  the character generator RAM, codes 128-255
 *
 * **The machine boots through a mirror.** A Z80 out of reset fetches from
 * address zero, and the Sorcerer's firmware is at 0xE000, so the ROM decode
 * answers the bottom 4K as the Monitor until the CPU reaches the Monitor's own
 * window - the Technical Manual is explicit that a replacement firmware must
 * therefore begin with a `C3` jump at 0xE000, because that jump is the only
 * instruction executed through the mirror. This models exactly that: the mirror
 * is dropped by the first read in 0xE000-0xEFFF, which is the jump's own
 * destination fetch, and RAM is underneath it all along.
 *
 * The character generator is the piece with no counterpart on the other
 * machines here. Its lower half is a ROM the CPU can read and not write; its
 * upper half is ordinary RAM that happens to be scanned by the video circuit,
 * which is how a program redefines a graphics character - and how the Monitor
 * puts the standard graphics set there at boot in the first place.
 */
export class SorcererMemory {
  /**
   * Every writable byte of the address space, indexed by CPU address: the
   * fitted RAM at the bottom, the Monitor workarea and screen at 0xF000, and
   * the character generator RAM at 0xFC00. The ROM windows in between are
   * present in the array and never addressed through it, which keeps each read
   * a single bounds-free index.
   */
  private readonly bytes = new Uint8Array(0x10000);
  private readonly monitor: Uint8Array;
  private readonly romPac: Uint8Array;
  private readonly charGenRom: Uint8Array;
  private bootMirror = true;

  /**
   * Live memory-activity recorder for the memory-map overlay. Disabled by
   * default; the host arms it only while the map is on screen. When enabled,
   * {@link read} and {@link write} stamp the touched CPU address with a single
   * indexed `|=` - which is the whole cost of recording being off, a not-taken
   * branch on the bus's hot path.
   */
  readonly activity = new MemoryActivityBuffer(0x10000);

  constructor(parts: {
    monitor: Uint8Array;
    romPac: Uint8Array;
    charGen: Uint8Array;
  }) {
    this.monitor = parts.monitor;
    this.romPac = parts.romPac;
    this.charGenRom = parts.charGen;
  }

  /** Screen RAM as a view, so the display reads it without going via the bus. */
  get screenRam(): Uint8Array {
    return this.bytes.subarray(SCREEN_BASE, SCREEN_BASE + SCREEN_BYTES);
  }

  /** The character generator RAM, codes 128-255, as a view. */
  get charGenRam(): Uint8Array {
    return this.bytes.subarray(CHARGEN_RAM_BASE, 0x10000);
  }

  /** The character generator ROM, codes 0-127. */
  get charGen(): Uint8Array {
    return this.charGenRom;
  }

  /** True while the Monitor is still mirrored over the bottom of memory. */
  get inBootMirror(): boolean {
    return this.bootMirror;
  }

  /** Back to power-on: RAM cleared, the Monitor mirrored over the bottom 4K. */
  reset(): void {
    this.bytes.fill(0);
    this.bootMirror = true;
    this.activity.clear();
  }

  read = (address: number): number => {
    if (this.activity.enabled) this.activity.hits[address & 0xffff] |= READ_BIT;
    return this.peek(address);
  };

  /**
   * Read a byte without recording the access.
   *
   * Everything the *host* reads goes through here rather than through
   * {@link read}: the run-state latch, the line the profiler samples and the
   * screen reader all poll this bus while the program runs, and stamping their
   * reads would paint the overlay with activity the program never performed.
   *
   * This is also the path that drops the boot mirror, because dropping it is a
   * property of the address decode rather than of who is looking - and the host
   * never reads the Monitor window mid-boot anyway.
   */
  peek = (address: number): number => {
    const a = address & 0xffff;
    if (a < MONITOR_SIZE && this.bootMirror) return this.rom(this.monitor, a);
    if (a < RAM_FITTED_BYTES) return this.bytes[a]!;
    if (a < ROM_PAC_BASE) return OPEN_BUS;
    if (a < MONITOR_BASE) return this.rom(this.romPac, a - ROM_PAC_BASE);
    if (a < MONITOR_WORKAREA_BASE) {
      // The fetch that lands here is the Monitor's own opening jump, and the
      // decode drops the mirror as soon as the CPU addresses this window.
      this.bootMirror = false;
      return this.rom(this.monitor, a - MONITOR_BASE);
    }
    if (a < CHARGEN_ROM_BASE) return this.bytes[a]!;
    if (a < CHARGEN_RAM_BASE) {
      return this.rom(this.charGenRom, a - CHARGEN_ROM_BASE);
    }
    return this.bytes[a]!;
  };

  write = (address: number, value: number): void => {
    if (this.activity.enabled)
      this.activity.hits[address & 0xffff] |= WRITE_BIT;
    this.poke(address, value);
  };

  /**
   * Write a byte without recording the access, for the host's own injection.
   *
   * A write to a ROM window or to the unpopulated span goes nowhere, as it does
   * on the machine. The boot mirror is deliberately *not* consulted: the RAM
   * under it is what the Monitor's memory sizing is writing to, and a write
   * swallowed by the mirror would make the machine believe it has no RAM at all.
   */
  poke = (address: number, value: number): void => {
    const a = address & 0xffff;
    const v = value & 0xff;
    if (a < RAM_FITTED_BYTES) {
      this.bytes[a] = v;
      return;
    }
    if (a < MONITOR_WORKAREA_BASE) return;
    if (a >= CHARGEN_ROM_BASE && a < CHARGEN_RAM_BASE) return;
    this.bytes[a] = v;
  };

  /** Little-endian word, for the interpreter pointers a load has to write. */
  readWord(address: number): number {
    return this.read(address) | (this.read((address + 1) & 0xffff) << 8);
  }

  /** {@link readWord} through {@link peek}: no activity recorded. */
  rawReadWord(address: number): number {
    return this.peek(address) | (this.peek((address + 1) & 0xffff) << 8);
  }

  writeWord(address: number, value: number): void {
    this.write(address, value & 0xff);
    this.write((address + 1) & 0xffff, (value >> 8) & 0xff);
  }

  /** One byte of a ROM image, or open bus where the image is short or absent. */
  private rom(image: Uint8Array, offset: number): number {
    return image[offset] ?? OPEN_BUS;
  }
}

/** Every part a running machine needs, so a short image is one check. */
export function hasFirmware(parts: {
  monitor: Uint8Array;
  romPac: Uint8Array;
  charGen: Uint8Array;
}): boolean {
  return (
    parts.monitor.length >= MONITOR_SIZE &&
    parts.romPac.length >= ROM_PAC_SIZE &&
    parts.charGen.length >= CHARGEN_ROM_SIZE
  );
}
