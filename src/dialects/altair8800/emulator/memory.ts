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

/** What an S-100 read returns with no memory board answering: open bus. */
const OPEN_BUS = 0xff;

export class Altair8800Memory {
  /** 64K flat address space; only the fitted portion is backed by real boards. */
  readonly bytes = new Uint8Array(0x10000);

  /** Highest address backed by a memory board; above this the bus floats. */
  readonly ramTop: number;

  /**
   * `ramKb` is the IDE's machine-wide RAM setting (16/32/64K). On an S-100
   * backplane it means "how many memory boards are plugged in", and the top of
   * the address space is deliberately left empty however many there are: the
   * 64K option is capped at {@link RAM_TOP}'s 48K, the configuration
   * `addresses.ts` documents and the dialect's `programRamBytes` is quoted from.
   * A genuinely full 64K would leave BASIC's sizing walk nothing to stop
   * against.
   */
  constructor(ramKb: 16 | 32 | 64 = 64) {
    this.ramTop = Math.min(ramKb * 1024 - 1, RAM_TOP);
  }

  /** Copy the Altair BASIC image into RAM at its load origin. */
  loadInterpreter(image: Uint8Array): void {
    this.bytes.fill(0);
    // An empty image is the designed ROM-absent state rather than an error -
    // the 8K BASIC tape is Microsoft copyright and does not ship here.
    this.bytes.set(image.subarray(0, this.bytes.length), 0);
  }

  read = (address: number): number => {
    const addr = address & 0xffff;
    return addr <= this.ramTop ? this.bytes[addr]! : OPEN_BUS;
  };

  write = (address: number, value: number): void => {
    const addr = address & 0xffff;
    if (addr > this.ramTop) return; // no board in that slot
    this.bytes[addr] = value & 0xff;
  };

  readWord(addr: number): number {
    return this.read(addr) | (this.read(addr + 1) << 8);
  }

  writeWord(addr: number, value: number): void {
    this.write(addr, value & 0xff);
    this.write(addr + 1, (value >> 8) & 0xff);
  }
}
