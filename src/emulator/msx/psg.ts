// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { Ay38912 } from '../ay';

/**
 * The MSX PSG: the shared AY-family chip on ports 0xA0 (address latch), 0xA1
 * (register write) and 0xA2 (register read).
 *
 * The part on this machine is a YM2149F inside the Yamaha S3527 MSX-Engine, and
 * it is register-compatible with the AY-3-8912 the Spectrum 128K and the CPC
 * carry, so only the wiring is here. The clock is the CPU's 3.579545MHz halved.
 *
 * The chip's two I/O ports are not the keyboard on this machine - that is the
 * PPI's own business. Port A (register 14) reads the two general-purpose
 * joystick ports and the cassette input; port B (register 15) selects which
 * joystick port answers and drives the pin-8 output. So a read of register 14
 * is a hardware sample rather than a register read-back, which is the one place
 * this wrapper does more than forward.
 */

/** The PSG clock: the 3.579545MHz Z80 clock divided by two. */
export const MSX_PSG_CLOCK = 1_789_772.5;

/** Register 14, the general-purpose input port the joysticks answer on. */
const REG_PORT_A = 14;
/** Register 15, the output port that selects which joystick port is read. */
const REG_PORT_B = 15;

/** Everything outside the chip that register 14 samples. */
export interface MsxPsgHost {
  /**
   * The selected joystick port as register 14's low six bits, active low:
   * bits 0-3 up/down/left/right, bits 4-5 the two triggers.
   */
  readJoystick(port: number): number;
  /** The cassette input bit (register 14 bit 7); 1 with no tape playing. */
  readTapeBit(): number;
}

export class MsxPsg {
  readonly chip = new Ay38912(MSX_PSG_CLOCK);
  private selected = 0;

  constructor(private readonly host: MsxPsgHost) {}

  reset(): void {
    this.chip.reset();
    this.selected = 0;
  }

  /** OUT to 0xA0: latch the register the next access reads or writes. */
  selectRegister(reg: number): void {
    this.selected = reg & 0x0f;
    this.chip.selectRegister(reg);
  }

  /** OUT to 0xA1. */
  write(value: number): void {
    this.chip.writeData(value);
  }

  /** IN from 0xA2. */
  read(): number {
    if (this.selected !== REG_PORT_A) return this.chip.readData();
    const port = (this.chip.readRegister(REG_PORT_B) >> 6) & 1;
    return (
      (this.host.readJoystick(port) & 0x3f) |
      0x40 | // bit 6 is the pin-8 read-back, high with nothing driving it
      (this.host.readTapeBit() ? 0x80 : 0)
    );
  }

  /** One frame of PSG audio. */
  render(): Float32Array {
    return this.chip.render();
  }
}
