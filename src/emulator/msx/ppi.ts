// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The 8255 PPI as MSX wires it (inside the Yamaha S3527 MSX-Engine on the
 * machines that integrate it), at ports 0xA8-0xAB:
 *
 *   Port A (0xA8)  primary slot select, two bits per 16KB page
 *   Port B (0xA9)  the selected keyboard matrix row, active low
 *   Port C (0xAA)  keyboard row select (bits 0-3), cassette motor (bit 4),
 *                  cassette write (bit 5), CAPS LED (bit 6), key click (bit 7)
 *   Control (0xAB) the 8255's own mode/bit-set register
 *
 * The same chip on the Amstrad is wired to entirely different things, so the
 * CPC's own model is a reference for how an 8255 behaves, not for what it is
 * connected to.
 */

/** Everything the PPI drives or samples that lives outside it. */
export interface MsxPpiHost {
  /** Latch the primary slot configuration written to port A. */
  selectSlots(value: number): void;
  /** The keyboard matrix row port C selected, as port B reads it. */
  readKeyboardRow(row: number): number;
  /** Cassette motor on/off, and the write data bit. */
  setTapeMotor(on: boolean): void;
  writeTapeBit(bit: number): void;
}

export class MsxPpi {
  constructor(_host: MsxPpiHost) {
    throw new Error('msx: PPI not implemented');
  }

  read(_port: number): number {
    throw new Error('msx: PPI not implemented');
  }

  write(_port: number, _value: number): void {
    throw new Error('msx: PPI not implemented');
  }
}
