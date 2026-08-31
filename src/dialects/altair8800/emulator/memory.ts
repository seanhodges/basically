// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Altair's memory - notable mainly for how little there is to it.
 *
 * The machine is a bare S-100 backplane: flat RAM from 0x0000 up to whatever
 * boards are fitted, no memory-mapped video, no I/O page, no banking. That
 * makes this the simplest bus in the project - almost all of the machine's
 * behaviour lives in `serial.ts` instead.
 *
 * The one structural surprise is that **there is no ROM**. The base Altair
 * shipped with no firmware at all: you either toggled a bootstrap in on the
 * front-panel switches or, more usually, loaded BASIC itself from paper tape,
 * where it sat in RAM from 0x0000 upwards. So `loadInterpreter` *copies* the
 * 8K BASIC image into RAM rather than mapping it read-only, and a POKE into
 * that region really does corrupt the interpreter, exactly as it did in 1975.
 *
 * The other thing this bus has to get right is where the memory *stops*. 8K
 * BASIC's cold start sizes RAM by writing to each location and reading it back
 * until one fails to hold the value, so an address space that is RAM all the way
 * to 0xFFFF has no top for that walk to find. The space above
 * {@link Altair8800Memory.ramTop} therefore has to behave like a backplane slot
 * with no board in it: writes vanish and reads float high.
 */
import { RAM_TOP } from '../addresses';
import {
  MemoryActivityBuffer,
  READ_BIT,
  WRITE_BIT,
} from '../../../emulator/memoryActivityBuffer';

/** What an S-100 read returns with no memory board answering: open bus. */
const OPEN_BUS = 0xff;

export class Altair8800Memory {
  /** 64K flat address space; only the fitted portion is backed by real boards. */
  readonly bytes = new Uint8Array(0x10000);

  /**
   * Live memory-activity recorder for the memory-map overlay. Disabled by
   * default; the host arms it only while the map is on screen. When enabled,
   * `read`/`write` stamp the touched CPU address with a single indexed `|=`.
   *
   * Stamped before the fitted-RAM check, so an access to the empty top of the
   * backplane still shows - the overlay's job is to show where the CPU went,
   * and BASIC's cold-start sizing walk going there is exactly the sort of thing
   * worth seeing.
   */
  readonly activity = new MemoryActivityBuffer(0x10000);

  /**
   * Highest address backed by a memory board; above this the bus floats.
   *
   * Fixed at {@link RAM_TOP}, and deliberately not taken from the IDE's
   * machine-wide 16/32/64K RAM setting. That setting describes a machine sold
   * in one size with an expansion option; an S-100 backplane held whatever
   * memory boards its owner had bought, so there is no "stock" size to track,
   * and this dialect commits to one documented configuration instead - the 48K
   * `addresses.ts` describes, which is where `index.ts`'s `programRamBytes` and
   * `memoryMap.ts`'s program region both come from. Letting the setting through
   * would have quietly contradicted all three (the IDE asks every machine for
   * 16K), and left the memory map describing a machine the user does not have.
   *
   * The top of the address space stays empty whatever the size: a genuinely
   * full 64K would leave BASIC's cold-start sizing walk nothing to stop
   * against.
   */
  readonly ramTop = RAM_TOP;

  /** Copy the Altair BASIC image into RAM at its load origin. */
  loadInterpreter(image: Uint8Array): void {
    this.bytes.fill(0);
    // An empty image is a designed state rather than an error: the bundled
    // tape is deletable, like every other image under public/roms/.
    this.bytes.set(image.subarray(0, this.bytes.length), 0);
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
    const addr = address & 0xffff;
    return addr <= this.ramTop ? this.bytes[addr]! : OPEN_BUS;
  };

  write = (address: number, value: number): void => {
    const addr = address & 0xffff;
    if (this.activity.enabled) this.activity.hits[addr] |= WRITE_BIT;
    if (addr > this.ramTop) return; // no board in that slot
    this.bytes[addr] = value & 0xff;
  };

  readWord(addr: number): number {
    return this.read(addr) | (this.read(addr + 1) << 8);
  }

  /** {@link readWord} through {@link peek}: no access is recorded. */
  rawReadWord(addr: number): number {
    return this.peek(addr) | (this.peek(addr + 1) << 8);
  }

  writeWord(addr: number, value: number): void {
    this.write(addr, value & 0xff);
    this.write(addr + 1, (value >> 8) & 0xff);
  }
}
