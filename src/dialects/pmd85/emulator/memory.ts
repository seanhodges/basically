// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import {
  MemoryActivityBuffer,
  READ_BIT,
  WRITE_BIT,
} from '../../../emulator/memoryActivityBuffer';
import { MONITOR_BASE, MONITOR_MIRROR_BASE } from '../addresses';
import { VIDEO_RAM_BASE, VIDEO_RAM_BYTES } from './display';

export { MONITOR_BASE, MONITOR_MIRROR_BASE } from '../addresses';

/**
 * What an address with nothing behind it reads as.
 *
 * The PMD 85's decoder leaves two 4K holes either side of the Monitor
 * (0x9000-0x9FFF and 0xB000-0xBFFF) plus two more in the startup map, and no
 * device drives the bus in them. A CMOS/TTL bus left floating settles high, so
 * they read 0xFF - the same answer the Altair gives for an S-100 address with
 * no card at it. Nothing in either ROM reads a hole, so this is a statement
 * about the hardware rather than a value anything depends on.
 */
export const OPEN_BUS = 0xff;

/**
 * The PMD 85 memory bus, in both of the configurations the machine has.
 *
 * The machine boots through the first one. Out of reset the address decoder
 * ignores A15 for the ROM, so the Monitor answers at 0x0000 as well as 0x8000
 * and the CPU's first instruction fetch finds firmware at address zero - the
 * usual trick for an 8080, which has no way to start anywhere else. Video RAM
 * is mirrored down to 0x4000 in the same configuration, and the 32K of ordinary
 * RAM is not reachable at all.
 *
 * **The switch is thrown by the first I/O write, not by an address.** There is
 * no bank-select port: the decoder watches for the CPU's first OUT and drops
 * the mirrors from that cycle on. The Monitor's third instruction is that OUT
 * (`LD A,$8A / OUT ($F7),A`, the keyboard 8255's mode word), which is why its
 * first two instructions are `LD SP,$8000` and a jump to its own 0x8006 - it
 * leaves the mirror before the mirror leaves it. So the machine cannot be
 * modelled with the normal map alone, and {@link leaveStartupMap} is called
 * from the machine's port write rather than from anything here.
 *
 * The normal map is RAM at 0x0000-0x7FFF, the Monitor at 0x8000-0x8FFF with a
 * mirror at 0xA000-0xAFFF, video RAM at 0xC000-0xFFFF, and holes between.
 */
export class Pmd85Memory {
  /**
   * Both banks of RAM in one array, indexed by CPU address: 0x0000-0x7FFF is
   * the 32K program RAM and 0xC000-0xFFFF the 16K of video RAM, with the
   * ROM/hole span 0x8000-0xBFFF present but never addressed. One array rather
   * than two keeps every read a single bounds-free index, and lets the display
   * take video RAM as a plain view onto it.
   */
  private readonly bytes = new Uint8Array(0x10000);
  private readonly monitor: Uint8Array;
  private startupMap = true;
  /**
   * Live memory-activity recorder for the memory-map overlay. Disabled by
   * default; the host arms it only while the map is on screen. When enabled,
   * {@link read} and {@link write} stamp the touched CPU address with a single
   * indexed `|=` - which is the whole cost of recording being off, a not-taken
   * branch on the bus's hot path.
   */
  readonly activity = new MemoryActivityBuffer(0x10000);

  constructor(monitor: Uint8Array) {
    this.monitor = monitor;
  }

  /**
   * The Monitor image itself, for the character generator inside it. Reading
   * the font off the bus would work only while the machine is in a
   * configuration that maps the ROM, and the screen reader has no business
   * caring which one it is in.
   */
  get monitorRom(): Uint8Array {
    return this.monitor;
  }

  /** Video RAM as a view, for the display to read without going through the bus. */
  get videoRam(): Uint8Array {
    return this.bytes.subarray(
      VIDEO_RAM_BASE,
      VIDEO_RAM_BASE + VIDEO_RAM_BYTES,
    );
  }

  /** True while the ROM mirrors are still over the bottom of the address space. */
  get inStartupMap(): boolean {
    return this.startupMap;
  }

  /** Back to power-on: RAM cleared, ROM mirrored over the bottom 16K. */
  reset(): void {
    this.bytes.fill(0);
    this.startupMap = true;
    this.activity.clear();
  }

  /**
   * Drop the startup mirrors, which the machine calls on the CPU's first I/O
   * write. Idempotent: every OUT after the first one lands here too.
   */
  leaveStartupMap(): void {
    this.startupMap = false;
  }

  read = (address: number): number => {
    if (this.activity.enabled) this.activity.hits[address & 0xffff] |= READ_BIT;
    return this.peek(address);
  };

  /**
   * Read a byte without recording the access.
   *
   * Everything the *host* reads goes through here rather than through
   * {@link read}: the variable watcher, the memory figures, the line the
   * profiler samples and the run-state latch all poll this bus while the
   * program runs, and stamping their reads would paint the overlay with
   * activity the program never performed.
   */
  peek = (address: number): number => {
    const a = address & 0xffff;
    if (this.startupMap && a < 0x8000) {
      // 0x0000 and 0x2000 answer as the ROM, 0x4000-0x7FFF as video RAM, and
      // the two 4K gaps between them have nothing behind them at all.
      if (a < 0x1000) return this.rom(a);
      if (a >= 0x2000 && a < 0x3000) return this.rom(a - 0x2000);
      if (a >= 0x4000) return this.bytes[VIDEO_RAM_BASE + (a - 0x4000)]!;
      return OPEN_BUS;
    }
    if (a < 0x8000) return this.bytes[a]!;
    if (a < 0x9000) return this.rom(a - MONITOR_BASE);
    if (a >= MONITOR_MIRROR_BASE && a < 0xb000) {
      return this.rom(a - MONITOR_MIRROR_BASE);
    }
    if (a >= VIDEO_RAM_BASE) return this.bytes[a]!;
    return OPEN_BUS;
  };

  write = (address: number, value: number): void => {
    if (this.activity.enabled)
      this.activity.hits[address & 0xffff] |= WRITE_BIT;
    const a = address & 0xffff;
    const v = value & 0xff;
    if (this.startupMap && a < 0x8000) {
      // Only the video-RAM mirror is writable in the startup map; a write to
      // the ROM mirrors or the gaps goes nowhere, which is what lets the
      // Monitor clear the screen before it has any RAM to clear.
      if (a >= 0x4000) this.bytes[VIDEO_RAM_BASE + (a - 0x4000)] = v;
      return;
    }
    if (a < 0x8000 || a >= VIDEO_RAM_BASE) this.bytes[a] = v;
  };

  /** Little-endian word, for the interpreter pointers a load has to write. */
  readWord(address: number): number {
    return this.read(address) | (this.read(address + 1) << 8);
  }

  /** {@link readWord} through {@link peek}: no activity recorded. */
  rawReadWord(address: number): number {
    return this.peek(address) | (this.peek(address + 1) << 8);
  }

  writeWord(address: number, value: number): void {
    this.write(address, value & 0xff);
    this.write(address + 1, (value >> 8) & 0xff);
  }

  /** One Monitor byte, or open bus where no image was supplied. */
  private rom(offset: number): number {
    return this.monitor[offset] ?? OPEN_BUS;
  }
}
