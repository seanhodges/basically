// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { JoystickState } from '../../dialects/types';

/**
 * The 6520 PIA: two eight-bit ports, and on a 400 or 800 both of them are
 * joysticks.
 *
 * PORTA carries sticks 1 and 2 a nibble each and PORTB sticks 3 and 4, all
 * active low - a switch closed pulls its line down. (The later XL machines
 * repurposed PORTB for memory management, which is why code written for one
 * will not run on the other.) The two control registers do rather more on paper
 * than this machine needs: PACTL bit 3 is the cassette motor and PBCTL bit 3
 * the serial command line, and neither has anything on the end of it here.
 *
 * The one behaviour a program will notice is bit 2 of a control register: with
 * it clear, reading the port reads that port's **data direction register**
 * instead. The OS depends on it to set the ports up at power-on.
 */

/** Register offsets within the PIA's page. */
const PORTA = 0x00;
const PORTB = 0x01;
const PACTL = 0x02;

/** Control register bit 2: 1 selects the port, 0 the data direction register. */
const PORT_SELECT = 0x04;

/** The four direction switches, in the order a joystick nibble carries them. */
const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;

export class Pia {
  private porta = 0;
  private portb = 0;
  private ddra = 0;
  private ddrb = 0;
  private pactl = 0;
  private pbctl = 0;

  /** The two sticks the on-screen controller can drive, port 0 and port 1. */
  private readonly sticks: (JoystickState | null)[] = [null, null];

  reset(): void {
    this.porta = 0;
    this.portb = 0;
    this.ddra = 0;
    this.ddrb = 0;
    this.pactl = 0;
    this.pbctl = 0;
    this.sticks[0] = null;
    this.sticks[1] = null;
  }

  /** Point one of the two ports at a virtual joystick, or at nothing. */
  setJoystick(port: number, state: JoystickState | null): void {
    this.sticks[port & 1] = state;
  }

  /**
   * The nibble a stick puts on its half of PORTA. Every switch is active low,
   * so an unplugged port - and one whose stick is centred - reads all ones.
   */
  private stickNibble(port: number): number {
    const stick = this.sticks[port];
    if (!stick) return 0x0f;
    let bits = 0x0f;
    for (let i = 0; i < DIRECTIONS.length; i++) {
      if (stick[DIRECTIONS[i]!]) bits &= ~(1 << i);
    }
    return bits & 0x0f;
  }

  read(reg: number): number {
    switch (reg) {
      case PORTA:
        if ((this.pactl & PORT_SELECT) === 0) return this.ddra;
        // An output line reads back what was written to it; an input line reads
        // the switches.
        return (
          ((this.porta & this.ddra) |
            ((this.stickNibble(0) | (this.stickNibble(1) << 4)) & ~this.ddra)) &
          0xff
        );
      case PORTB:
        if ((this.pbctl & PORT_SELECT) === 0) return this.ddrb;
        // Sticks 3 and 4, which this machine never has plugged in.
        return ((this.portb & this.ddrb) | (0xff & ~this.ddrb)) & 0xff;
      case PACTL:
        return this.pactl;
      default:
        return this.pbctl;
    }
  }

  write(reg: number, value: number): void {
    const byte = value & 0xff;
    switch (reg) {
      case PORTA:
        if ((this.pactl & PORT_SELECT) === 0) this.ddra = byte;
        else this.porta = byte;
        return;
      case PORTB:
        if ((this.pbctl & PORT_SELECT) === 0) this.ddrb = byte;
        else this.portb = byte;
        return;
      case PACTL:
        this.pactl = byte;
        return;
      default:
        this.pbctl = byte;
        return;
    }
  }
}
