// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Apple I's 6821 PIA, the only interface chip on the board.
 *
 * Side A is the keyboard: PA0-PA6 read the ASCII latch, PA7 is strapped to +5V
 * (which is why every key code the machine sees has bit 7 set), and the
 * keyboard's strobe drives CA1. Side B is the display: PB0-PB6 carry the
 * character out to the terminal section and PB7 reads its busy line back.
 *
 * Only the parts the machine actually uses are modelled, and the one that
 * cannot be skipped is the control register's bit 2. Both data addresses are
 * two registers behind one address - the data direction register while bit 2 is
 * clear, the peripheral register once it is set - and the monitor relies on it:
 * at `$FF04` it writes `$7F` to `$D012` while the control register is still
 * zeroed, which is a DDR write making PB0-PB6 outputs, and only then sets `$A7`
 * into both control registers. A model without the switch would print that
 * `$7F` as a character before the machine had run five instructions.
 *
 * The interrupt outputs are deliberately not modelled: the Apple I leaves
 * IRQA and IRQB unconnected, so the CA1 flag this chip raises is polled by the
 * monitor and by Integer BASIC and nothing on the board can interrupt the CPU.
 * The monitor's own `CLI` at `$FF01` is safe for exactly that reason.
 */

/** Register selects, as the low two address lines present them. */
export const ORA = 0;
export const CRA = 1;
export const ORB = 2;
export const CRB = 3;

/** Control-register bit 2: 0 selects the data direction register, 1 the port. */
const DATA_SELECT = 0x04;

/** Control-register bit 7: the CA1/CB1 interrupt flag. */
const IRQ1_FLAG = 0x80;

/** The board's connections to the two ports. */
export interface Apple1PiaPorts {
  /** Input pin values on side A: the keyboard latch, PA7 strapped high. */
  readPortA(): number;
  /** Input pin values on side B: the terminal's busy line on PB7. */
  readPortB(): number;
  /** Side B's port register was written: a character for the terminal. */
  writePortB(value: number): void;
}

export class Apple1Pia {
  private ddrA = 0;
  private outA = 0;
  private ctrlA = 0;
  private ddrB = 0;
  private outB = 0;
  private ctrlB = 0;
  /** CA1 has gone active since side A was last read: a key is waiting. */
  private keyStrobe = false;

  constructor(private readonly ports: Apple1PiaPorts) {}

  /** Power-on / RESET: every register clear, so both sides read as inputs. */
  reset(): void {
    this.ddrA = 0;
    this.outA = 0;
    this.ctrlA = 0;
    this.ddrB = 0;
    this.outB = 0;
    this.ctrlB = 0;
    this.keyStrobe = false;
  }

  /** The keyboard strobed CA1: a character is in the latch. */
  strobeKey(): void {
    this.keyStrobe = true;
  }

  /** Whether the strobe flag is still set, i.e. the key has not been taken. */
  get keyWaiting(): boolean {
    return this.keyStrobe;
  }

  read(register: number): number {
    switch (register & 3) {
      case ORA:
        if ((this.ctrlA & DATA_SELECT) === 0) return this.ddrA;
        // Reading the port clears CA1. The latch itself keeps the character -
        // the flag, not the data, is what says a key is new, which is why the
        // monitor reads KBDCR first and KBD only once it is set.
        this.keyStrobe = false;
        return this.pins(this.outA, this.ddrA, this.ports.readPortA());
      case CRA:
        return (this.ctrlA & 0x3f) | (this.keyStrobe ? IRQ1_FLAG : 0);
      case ORB:
        if ((this.ctrlB & DATA_SELECT) === 0) return this.ddrB;
        return this.pins(this.outB, this.ddrB, this.ports.readPortB());
      default:
        // CB1 is not wired on this board, so side B's control register has no
        // flag to report and reads back exactly what was written.
        return this.ctrlB & 0x3f;
    }
  }

  /** Side-effect-free read, for host introspection that must not take a key. */
  peek(register: number): number {
    switch (register & 3) {
      case ORA:
        return (this.ctrlA & DATA_SELECT) === 0
          ? this.ddrA
          : this.pins(this.outA, this.ddrA, this.ports.readPortA());
      case CRA:
        return (this.ctrlA & 0x3f) | (this.keyStrobe ? IRQ1_FLAG : 0);
      case ORB:
        return (this.ctrlB & DATA_SELECT) === 0
          ? this.ddrB
          : this.pins(this.outB, this.ddrB, this.ports.readPortB());
      default:
        return this.ctrlB & 0x3f;
    }
  }

  write(register: number, value: number): void {
    const byte = value & 0xff;
    switch (register & 3) {
      case ORA:
        if ((this.ctrlA & DATA_SELECT) === 0) this.ddrA = byte;
        else this.outA = byte;
        return;
      case CRA:
        // Bits 6 and 7 are the read-only interrupt flags.
        this.ctrlA = byte & 0x3f;
        return;
      case ORB:
        if ((this.ctrlB & DATA_SELECT) === 0) {
          this.ddrB = byte;
          return;
        }
        this.outB = byte;
        // Only the pins the DDR makes outputs reach the terminal; PB7 is the
        // busy line coming back the other way, so the character is seven bits.
        this.ports.writePortB(byte & this.ddrB);
        return;
      default:
        this.ctrlB = byte & 0x3f;
        return;
    }
  }

  /** What a port reads: the output register on output pins, the world on inputs. */
  private pins(out: number, ddr: number, input: number): number {
    return ((out & ddr) | (input & ~ddr)) & 0xff;
  }
}
