// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { BusInterface } from '../6502/cpu6502.js';
import {
  BASIC_CARTRIDGE_BASE,
  BASIC_CARTRIDGE_BYTES,
  HARDWARE_BASE,
  OS_ROM_BASE,
  OS_ROM_BYTES,
} from '../../dialects/atari800/addresses';

/**
 * The Atari 400/800 address decoding: RAM from zero to however much is fitted,
 * the BASIC cartridge, the four hardware chips in their pages, and the OS ROM.
 *
 * ### Why everything lives in one 64K array
 *
 * ANTIC has its own bus and fetches the display list, the screen and the
 * character generator without going through the CPU at all - and the character
 * generator it fetches by default is inside the OS ROM at `$E000`. Holding RAM
 * and both ROM images in one flat array by CPU address is what lets the video
 * chip read a byte the same way wherever it came from, and lets the host's own
 * introspection (the zero-page pointers, the screen reader) index by address.
 *
 * ### Where the memory ends
 *
 * `ramTop` is the whole hardware difference between the two machines: `$C000`
 * on a 48K 800, `$4000` on a 16K 400. Above it and below the cartridge there is
 * no RAM fitted and nothing driving the data lines, so those addresses read as
 * `$FF` and swallow writes - which is exactly what the OS's power-on memory
 * sizing walks the address space looking for.
 */

/** Every unfitted address reads as a floating bus. */
const OPEN_BUS = 0xff;

/** Top of the cartridge window, and the last address a program can reach. */
const CARTRIDGE_TOP = BASIC_CARTRIDGE_BASE + BASIC_CARTRIDGE_BYTES - 1;

/** The hardware pages, each 256 bytes of one chip mirrored across the page. */
const GTIA_PAGE = 0xd000;
const POKEY_PAGE = 0xd200;
const PIA_PAGE = 0xd300;
const ANTIC_PAGE = 0xd400;

/** How far a chip's registers repeat: the page decode reaches no further. */
const GTIA_REGISTERS = 0x1f;
const POKEY_REGISTERS = 0x0f;
const PIA_REGISTERS = 0x03;
const ANTIC_REGISTERS = 0x0f;

/** The chip register handlers the bus dispatches to. */
export interface AtariChips {
  readGtia(reg: number): number;
  writeGtia(reg: number, value: number): void;
  readPokey(reg: number): number;
  writePokey(reg: number, value: number): void;
  readPia(reg: number): number;
  writePia(reg: number, value: number): void;
  readAntic(reg: number): number;
  writeAntic(reg: number, value: number): void;
}

export class AtariMemory {
  /**
   * The whole 64K space as one array: RAM low down, the cartridge and OS images
   * where they are mapped, and untouched zeros behind the hardware pages, which
   * are never read back from here.
   */
  readonly mem = new Uint8Array(0x10000);

  /**
   * One past the last RAM address. Everything from here to the cartridge is
   * unfitted on this machine.
   */
  readonly ramTop: number;

  constructor(ramTop: number) {
    this.ramTop = ramTop;
  }

  /**
   * Power-on: clear the RAM and lay the supplied firmware image into the two
   * places it belongs. The image is the OS followed by the cartridge (see
   * `scripts/build-atari-rom.mts`), so a short image leaves the cartridge window
   * as whatever the seam padded it with - and an all-`$FF` cartridge window is
   * how a machine says its slot is empty.
   */
  loadFirmware(firmware: Uint8Array): void {
    this.mem.fill(0);
    this.mem.fill(OPEN_BUS, this.ramTop, BASIC_CARTRIDGE_BASE);
    this.mem.set(firmware.subarray(0, OS_ROM_BYTES), OS_ROM_BASE);
    this.mem.set(
      firmware.subarray(OS_ROM_BYTES, OS_ROM_BYTES + BASIC_CARTRIDGE_BYTES),
      BASIC_CARTRIDGE_BASE,
    );
  }

  /** Clear the RAM without disturbing either ROM image. */
  clearRam(): void {
    this.mem.fill(0, 0, this.ramTop);
  }

  /** Whether `address` is RAM this machine actually has fitted. */
  isRam(address: number): boolean {
    return address < this.ramTop;
  }

  /**
   * The bus the CPU core is constructed over. `peek`/`poke` are the
   * side-effect-free pair: a peek must never take a key out of POKEY's latch or
   * clear ANTIC's interrupt status, because the host reads through them while
   * the machine is stopped.
   */
  makeBus(chips: AtariChips): BusInterface {
    const mem = this.mem;
    const ramTop = this.ramTop;

    const read = (address: number): number => {
      const a = address & 0xffff;
      if (a < ramTop) return mem[a]!;
      if (a < HARDWARE_BASE) {
        // The cartridge is the only thing fitted up here; on a 16K 400 the gap
        // below it is empty sockets.
        return a >= BASIC_CARTRIDGE_BASE && a <= CARTRIDGE_TOP
          ? mem[a]!
          : OPEN_BUS;
      }
      if (a >= OS_ROM_BASE) return mem[a]!;
      switch (a & 0xff00) {
        case GTIA_PAGE:
          return chips.readGtia(a & GTIA_REGISTERS);
        case POKEY_PAGE:
          return chips.readPokey(a & POKEY_REGISTERS);
        case PIA_PAGE:
          return chips.readPia(a & PIA_REGISTERS);
        case ANTIC_PAGE:
          return chips.readAntic(a & ANTIC_REGISTERS);
        default:
          // $D100 is the parallel bus connector and $D500-$D7FF the cartridge
          // control lines; on a bare 400/800 neither has anything on it.
          return OPEN_BUS;
      }
    };

    const write = (address: number, value: number): void => {
      const a = address & 0xffff;
      const byte = value & 0xff;
      if (a < ramTop) {
        mem[a] = byte;
        return;
      }
      // Both ROMs ignore writes, and so does an empty socket.
      if (a < HARDWARE_BASE || a >= OS_ROM_BASE) return;
      switch (a & 0xff00) {
        case GTIA_PAGE:
          chips.writeGtia(a & GTIA_REGISTERS, byte);
          return;
        case POKEY_PAGE:
          chips.writePokey(a & POKEY_REGISTERS, byte);
          return;
        case PIA_PAGE:
          chips.writePia(a & PIA_REGISTERS, byte);
          return;
        case ANTIC_PAGE:
          chips.writeAntic(a & ANTIC_REGISTERS, byte);
          return;
        default:
          return;
      }
    };

    return {
      read,
      write,
      peek: (address: number): number => {
        const a = address & 0xffff;
        // Reading a hardware register can latch, clear or consume; the host
        // peeks while stopped, so the chips are not asked at all.
        if (a >= HARDWARE_BASE && a < OS_ROM_BASE) return OPEN_BUS;
        return read(a);
      },
      poke: write,
      readWord: (address: number): number =>
        read(address) | (read(address + 1) << 8),
    };
  }

  /** A 16-bit little-endian pointer, read straight out of the array. */
  peekWord(address: number): number {
    return (
      this.mem[address & 0xffff]! | (this.mem[(address + 1) & 0xffff]! << 8)
    );
  }
}
