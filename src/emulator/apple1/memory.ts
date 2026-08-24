// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { BusInterface } from '../6502/cpu6502.js';
import {
  BASIC_BASE,
  BASIC_BYTES,
  BASIC_TOP,
  MONITOR_BASE,
  MONITOR_BYTES,
  RAM_TOP,
} from '../../dialects/apple1/addresses';
import type { Apple1Pia } from './pia';

/**
 * The Apple I's address decoding: 4K of RAM, one interface chip, the jumpered
 * block Integer BASIC lives in, and the monitor PROM. Everything else on the
 * 64K map is simply not fitted.
 *
 * ### Why the PIA is everywhere in `$Dxxx`
 *
 * The board decodes the top four address lines to a page select and hands the
 * PIA's chip selects that page and **A4** alone; A0 and A1 are the chip's
 * register selects and A2, A3 and A5-A11 reach nothing. So the four registers
 * do not sit at `$D010`-`$D013` so much as repeat across the whole of `$D000`-
 * `$DFFF` wherever A4 is set - `$D014`, `$D110`, `$D9F2` and hundreds more are
 * the same four cells. `$D010` is only the address the monitor happens to use.
 * Modelling the mirroring rather than the four addresses is what makes a
 * program that reaches the keyboard by any other alias behave as it would on
 * the machine.
 *
 * ### Open bus
 *
 * `$1000`-`$CFFF` and `$F000`-`$FEFF` have nothing on them at all: no RAM, no
 * decode, nothing driving the data lines. They read as `$FF` here, which is
 * both what a floating NMOS bus pulled up settles to and what makes an
 * accidental jump into one land on a run of `SBC` rather than on a page of
 * plausible-looking code.
 */

/** Every unfitted address reads as a floating bus. */
const OPEN_BUS = 0xff;

/** The PIA's page, and the address line that selects the chip within it. */
const PIA_PAGE = 0xd000;
const PIA_SELECT = 0x0010;
const PIA_MASK = 0xf010;

export class Apple1Memory {
  /**
   * The whole 64K space as one array, of which only the fitted windows are ever
   * read back: low RAM, the `$E000` block and the monitor image. Flat because
   * every host-side reader - the zero-page pointers, the program area, the
   * memory-activity overlay - wants to index by CPU address.
   */
  readonly mem = new Uint8Array(0x10000);

  constructor(private readonly pia: Apple1Pia) {}

  /**
   * Power-on: clear the RAM and lay the supplied firmware image into the two
   * places it belongs. The image is the monitor followed by the interpreter (see
   * `scripts/build-apple1-rom.mts`), so a short image leaves the interpreter
   * block as whatever the seam padded it with.
   */
  loadFirmware(firmware: Uint8Array): void {
    this.mem.fill(0);
    this.mem.set(firmware.subarray(0, MONITOR_BYTES), MONITOR_BASE);
    this.mem.set(
      firmware.subarray(MONITOR_BYTES, MONITOR_BYTES + BASIC_BYTES),
      BASIC_BASE,
    );
  }

  read = (address: number): number => {
    const a = address & 0xffff;
    if (a <= RAM_TOP) return this.mem[a]!;
    if ((a & PIA_MASK) === (PIA_PAGE | PIA_SELECT)) return this.pia.read(a & 3);
    if (a >= BASIC_BASE && a <= BASIC_TOP) return this.mem[a]!;
    if (a >= MONITOR_BASE) return this.mem[a]!;
    return OPEN_BUS;
  };

  write = (address: number, value: number): void => {
    const a = address & 0xffff;
    const byte = value & 0xff;
    if (a <= RAM_TOP) {
      this.mem[a] = byte;
      return;
    }
    if ((a & PIA_MASK) === (PIA_PAGE | PIA_SELECT)) {
      this.pia.write(a & 3, byte);
      return;
    }
    // The interpreter block is RAM on this machine - Integer BASIC arrived on
    // tape, not in a chip - so a program really can overwrite it. The monitor
    // is a PROM and ignores writes; everything else has nothing to write to.
    if (a >= BASIC_BASE && a <= BASIC_TOP) this.mem[a] = byte;
  };

  /** Side-effect-free read: never takes a key out of the PIA's latch. */
  peek = (address: number): number => {
    const a = address & 0xffff;
    if (a <= RAM_TOP) return this.mem[a]!;
    if ((a & PIA_MASK) === (PIA_PAGE | PIA_SELECT)) return this.pia.peek(a & 3);
    if (a >= BASIC_BASE && a <= BASIC_TOP) return this.mem[a]!;
    if (a >= MONITOR_BASE) return this.mem[a]!;
    return OPEN_BUS;
  };

  poke = (address: number, value: number): void => {
    this.write(address, value);
  };

  readWord = (address: number): number =>
    this.read(address) | (this.read(address + 1) << 8);

  /** A 16-bit little-endian pointer, read without touching the bus. */
  peekWord(address: number): number {
    return this.peek(address) | (this.peek(address + 1) << 8);
  }

  /** The bus the CPU core is constructed over. */
  bus(): BusInterface {
    return {
      read: this.read,
      write: this.write,
      peek: this.peek,
      poke: this.poke,
      readWord: this.readWord,
    };
  }
}
