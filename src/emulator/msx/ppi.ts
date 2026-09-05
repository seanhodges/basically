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
 *
 * The three output bits above bit 4 are active low: the BIOS writes a 0 to run
 * the cassette motor and a 0 to light the CAPS lamp, so the reset value of
 * 0x50 is "motor off, lamp off" rather than "everything off".
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

/** Port C after a reset: row 0 selected, motor off, CAPS lamp off. */
const PORT_C_RESET = 0x50;

export class MsxPpi {
  private portA = 0;
  private portC = PORT_C_RESET;

  constructor(private readonly host: MsxPpiHost) {}

  reset(): void {
    this.portA = 0;
    this.host.selectSlots(0);
    this.writePortC(PORT_C_RESET);
  }

  /** The keyboard row currently selected on port C's low nibble. */
  get keyboardRow(): number {
    return this.portC & 0x0f;
  }

  /** Cassette motor running; the bit is active low. */
  get tapeMotorOn(): boolean {
    return (this.portC & 0x10) === 0;
  }

  /** CAPS lamp lit; also active low. Read by the case indicator, not the BIOS. */
  get capsLedOn(): boolean {
    return (this.portC & 0x40) === 0;
  }

  /** A CPU read from one of the four PPI registers (`reg` = A/B/C/control). */
  read(reg: number): number {
    switch (reg & 0x03) {
      case 0:
        return this.portA;
      case 1:
        return this.host.readKeyboardRow(this.keyboardRow);
      case 2:
        return this.portC;
      default:
        return 0xff; // the control register is write-only
    }
  }

  /** A CPU write to one of the four PPI registers. */
  write(reg: number, value: number): void {
    const v = value & 0xff;
    switch (reg & 0x03) {
      case 0:
        this.portA = v;
        this.host.selectSlots(v);
        break;
      case 1:
        break; // port B is the keyboard input; a write lands nowhere
      case 2:
        this.writePortC(v);
        break;
      case 3:
        this.writeControl(v);
        break;
    }
  }

  /**
   * The 8255 control register. Bit 7 set is a mode word, which on MSX only ever
   * arrives as the one configuration the standard fixes (A and C out, B in) and
   * so needs no decoding beyond resetting the outputs. Bit 7 clear is a bit
   * set/reset on port C, and that is the path that matters: the BIOS toggles
   * the cassette motor, the key click and the CAPS lamp one bit at a time and
   * never rewrites the whole port.
   */
  private writeControl(v: number): void {
    if (v & 0x80) {
      this.writePortC(0);
      return;
    }
    const bit = (v >> 1) & 0x07;
    const next =
      v & 0x01 ? this.portC | (1 << bit) : this.portC & ~(1 << bit) & 0xff;
    this.writePortC(next);
  }

  /** Latch port C and drive whatever changed on it. */
  private writePortC(v: number): void {
    const before = this.portC;
    this.portC = v & 0xff;
    if (((before ^ this.portC) & 0x10) !== 0) {
      this.host.setTapeMotor(this.tapeMotorOn);
    }
    if (((before ^ this.portC) & 0x20) !== 0) {
      this.host.writeTapeBit((this.portC >> 5) & 1);
    }
  }
}
