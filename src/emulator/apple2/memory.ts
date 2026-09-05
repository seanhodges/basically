// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { BusInterface } from '../6502/cpu6502.js';
import {
  IO_BASE,
  IO_TOP,
  RAM_TOP,
  ROM_BASE,
  ROM_TOP,
} from '../../dialects/apple2/addresses';

/**
 * The Apple II's address decoding: 48K of RAM, one page of I/O, and the ROM
 * window above it.
 *
 * ### Why `$C000`-`$CFFF` is a dispatch and not an array
 *
 * Nothing in that page is memory. Every address in it is a wire, and *touching*
 * the address is the whole transaction: a read throws the switch exactly as a
 * write does, which is why `POKE -16304,0` and `PEEK(-16304)` both turn the
 * graphics on and why a BASIC with no `POKE` at all could still drive the
 * machine. Several of the switches are then also the only way to read something
 * back - `$C000` hands over the keyboard latch on the same access - so a read
 * here returns a value *and* has an effect, which an array cannot express.
 *
 * The low half of the page decodes on address bits 6-4 alone, so each group of
 * sixteen addresses is one device repeated sixteen times: any of
 * `$C010`-`$C01F` clears the keyboard strobe, any of `$C030`-`$C03F` clicks the
 * speaker. Modelling the group rather than the one address the monitor happens
 * to use is what makes a program reaching a switch by any other alias behave as
 * it would on the machine.
 *
 * ### Open bus
 *
 * `$C100`-`$CFFF` is peripheral-card ROM space and this machine has no cards in
 * it; the write-only switches have nothing to return either. On the hardware
 * both cases read as whatever the video scanner was fetching at that instant -
 * the "floating bus" - which is a real signal some programs time themselves
 * against. It is not modelled: those addresses read as `$FF` here, which is what
 * an undriven NMOS bus settles to and what makes an accidental jump into one
 * land on a run of `SBC` rather than on a page of plausible-looking code.
 */

/** Every unfitted address reads as a floating bus. */
const OPEN_BUS = 0xff;

/** The devices the `$C0xx` groups dispatch to. */
export interface Apple2IoPorts {
  /** `$C000`-`$C00F` read: the keyboard latch, bit 7 the strobe. */
  readKeyboard(): number;
  /** `$C010`-`$C01F` any access: clear the strobe. */
  clearKeyStrobe(): void;
  /** `$C030`-`$C03F` any access: move the speaker cone. */
  toggleSpeaker(): void;
  /** `$C050`-`$C05F` any access: the display flip-flops and annunciators. */
  displaySwitch(address: number): void;
  /** `$C060`-`$C06F` read: the cassette input, the buttons, the paddle timers. */
  readInput(address: number): number;
  /** `$C070`-`$C07F` any access: start the paddle one-shots. */
  triggerPaddles(): void;
}

/** The group each sixteen-address block of the low I/O half selects. */
const enum IoGroup {
  Keyboard = 0x0,
  ClearStrobe = 0x1,
  CassetteOut = 0x2,
  Speaker = 0x3,
  UtilityStrobe = 0x4,
  DisplaySwitch = 0x5,
  Inputs = 0x6,
  PaddleTrigger = 0x7,
}

export class Apple2Memory {
  /**
   * The whole 64K space as one array, of which only RAM and the ROM window are
   * ever read back through it. Flat because every host-side reader - the
   * zero-page pointers, the display pages, the memory-activity overlay - wants
   * to index by CPU address.
   */
  readonly mem = new Uint8Array(0x10000);

  constructor(private readonly io: Apple2IoPorts) {}

  /**
   * Power-on: clear the RAM and lay the firmware image into the ROM window. The
   * image is the whole `$D000`-`$FFFF` window in address order, so a short one
   * leaves the top of the window as zeros and the machine has no reset vector
   * to start from - which is what {@link Apple2Machine} checks before running.
   */
  loadFirmware(firmware: Uint8Array): void {
    this.mem.fill(0);
    this.mem.set(firmware.subarray(0, ROM_TOP - ROM_BASE + 1), ROM_BASE);
  }

  read = (address: number): number => {
    const a = address & 0xffff;
    if (a <= RAM_TOP) return this.mem[a]!;
    if (a >= ROM_BASE) return this.mem[a]!;
    return this.touchIo(a);
  };

  write = (address: number, value: number): void => {
    const a = address & 0xffff;
    if (a <= RAM_TOP) {
      this.mem[a] = value & 0xff;
      return;
    }
    // The ROM window is four sockets of mask ROM; a write to it is ignored, and
    // there is no language card here to give it RAM instead.
    if (a >= ROM_BASE) return;
    this.touchIo(a);
  };

  /**
   * Side-effect-free read: never clears the keyboard strobe, clicks the speaker
   * or throws a display switch. The I/O page has nothing to report without
   * touching it, so it answers as an unfitted address does.
   */
  peek = (address: number): number => {
    const a = address & 0xffff;
    if (a <= RAM_TOP) return this.mem[a]!;
    if (a >= ROM_BASE) return this.mem[a]!;
    return OPEN_BUS;
  };

  /**
   * Side-effect-free write, for the host laying bytes into the machine. It
   * reaches RAM only: a host poke is not a bus cycle, and one that clicked the
   * speaker or reset the display mode on the way past would be the IDE's
   * behaviour showing up as the program's.
   */
  poke = (address: number, value: number): void => {
    const a = address & 0xffff;
    if (a <= RAM_TOP) this.mem[a] = value & 0xff;
  };

  readWord = (address: number): number =>
    this.read(address) | (this.read((address + 1) & 0xffff) << 8);

  /** A 16-bit little-endian pointer, read without touching the bus. */
  peekWord(address: number): number {
    return this.peek(address) | (this.peek((address + 1) & 0xffff) << 8);
  }

  /** Write a 16-bit little-endian pointer straight into RAM. */
  pokeWord(address: number, value: number): void {
    this.poke(address, value & 0xff);
    this.poke(address + 1, (value >> 8) & 0xff);
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

  /**
   * One access anywhere in `$C000`-`$CFFF`, whichever direction it came from.
   * Returns what a read of that address answers; a write discards it, having
   * already had the effect it came for.
   */
  private touchIo(address: number): number {
    if (address < IO_BASE || address > IO_TOP) return OPEN_BUS;
    // Above $C0FF is card space, and nothing is plugged into this machine.
    if (address > 0xc0ff) return OPEN_BUS;
    switch ((address >> 4) & 0x0f) {
      case IoGroup.Keyboard:
        return this.io.readKeyboard();
      case IoGroup.ClearStrobe:
        this.io.clearKeyStrobe();
        // The strobe is what bit 7 was; with it cleared there is nothing left
        // to report, and the monitor reads this address only for the effect.
        return this.io.readKeyboard() & 0x7f;
      case IoGroup.Speaker:
        this.io.toggleSpeaker();
        return OPEN_BUS;
      case IoGroup.DisplaySwitch:
        this.io.displaySwitch(address);
        return OPEN_BUS;
      case IoGroup.Inputs:
        return this.io.readInput(address);
      case IoGroup.PaddleTrigger:
        this.io.triggerPaddles();
        return OPEN_BUS;
      case IoGroup.CassetteOut:
      case IoGroup.UtilityStrobe:
        // The cassette output toggle and the game connector's utility strobe:
        // both are outputs to hardware this machine does not yet have on the
        // other end of, and both are harmless to touch.
        return OPEN_BUS;
      default:
        return OPEN_BUS;
    }
  }
}
