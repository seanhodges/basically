// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The I/O board's GPIO MHB8255A, and the joystick that plugs into it.
 *
 * This is the second of the machine's three 8255s and the only one neither ROM
 * has any interest in: the Monitor writes it a mode word at boot and never
 * looks at it again. It is here because it is where a joystick goes.
 *
 * One chip serves two connectors. **GPIO0** (K3) is port A plus the top half of
 * port C, **GPIO1** (K4) is port B plus the bottom half - so a machine with two
 * joysticks reads one from each data port. The IDE has one controller, so it
 * drives GPIO0 and leaves GPIO1 reading as an empty socket.
 *
 * The official joystick is the **4004/482**, which reports five switches on the
 * low five bits, active low:
 *
 *     bit 0 down · bit 1 up · bit 2 right · bit 3 left · bit 4 fire
 *
 * so an untouched stick reads 0xFF and the documented read is `IN / CMA /
 * ANI 1Fh`. There is one fire line, not two.
 *
 * The catch, and the reason the direction latch is modelled rather than
 * ignored: the connector's data lines run through an MH8286 bidirectional
 * driver, and the 4004/482 exists partly to keep software from pointing that
 * driver at a stick that is already driving the pins. A program must turn the
 * buffer inward before it reads - `OUT 78,17`, setting PC4 for GPIO0 and PC0
 * for GPIO1 - and until it does, the stick is not connected to the port. So a
 * read here answers 0xFF unless the matching direction bit is set, which is
 * also what keeps the Monitor's boot-time mode word from picking up phantom
 * input: it sets PC6 and PC2, not PC4.
 *
 * Facts from the PMD 85 Infoserver's Joystick 4004/482 and connector pages;
 * the port addresses agree with MAME's `pmd85` I/O map (`010011aa`).
 */

import type { JoystickState } from '../../types';

/** The four addresses the chip answers on; it also mirrors, as they all do. */
export const PORT_GPIO0 = 0x4c; // port A: GPIO0's data, so joystick 1
export const PORT_GPIO1 = 0x4d; // port B: GPIO1's data, so joystick 2
export const PORT_DIRECTION = 0x4e; // port C: both connectors' buffer direction
export const PORT_CONTROL = 0x4f; // the 8255's own mode register

/** Which port C bit turns GPIO0's MH8286 inward; GPIO1's is PC0. */
const GPIO0_INPUT = 0x10; // PC4

/** The 4004/482's switches, active low. */
const DOWN = 0x01;
const UP = 0x02;
const RIGHT = 0x04;
const LEFT = 0x08;
const FIRE = 0x10;

/** What a data port reads with its buffer the wrong way or nothing plugged in. */
const NOT_DRIVEN = 0xff;

/** The 4004/482's five switches as the port sees them: pressed is a zero. */
function switchBits(joystick: JoystickState | null): number {
  if (!joystick) return NOT_DRIVEN;
  let pressed = 0;
  if (joystick.down) pressed |= DOWN;
  if (joystick.up) pressed |= UP;
  if (joystick.right) pressed |= RIGHT;
  if (joystick.left) pressed |= LEFT;
  // One fire line on this stick, so either button on a two-button pad works it
  // rather than the second one doing nothing.
  if (joystick.fire1 || joystick.fire2) pressed |= FIRE;
  return ~pressed & 0xff;
}

export class Pmd85Gpio {
  /** The port C output latch: the two buffer-direction bits and four spares. */
  private direction = 0;
  /** GPIO0's stick, or null while the IDE's controller is not driving one. */
  private joystick: JoystickState | null = null;

  /** Point the controller at GPIO0, the connector a single joystick uses. */
  setJoystick(state: JoystickState): void {
    this.joystick = { ...state };
  }

  readPort(register: number): number {
    switch (register) {
      case 0:
        return this.direction & GPIO0_INPUT
          ? switchBits(this.joystick)
          : NOT_DRIVEN;
      case 1:
        // GPIO1 is an empty socket here even with its buffer turned inward.
        return NOT_DRIVEN;
      case 2:
        // An 8255 in mode 0 reads an output port back as its latch, which is
        // how a program flips one connector's direction without losing the
        // other's.
        return this.direction;
      default:
        return NOT_DRIVEN; // the mode register is write-only
    }
  }

  writePort(register: number, value: number): void {
    switch (register) {
      case 2:
        this.direction = value & 0xff;
        return;
      case 3:
        // A mode word clears the latches; the bit set/reset form addresses one
        // port C bit, which is how the documented setup turns a single
        // connector inward without disturbing the other.
        if (value & 0x80) {
          this.direction = 0;
        } else {
          const bit = (value >> 1) & 0x07;
          if (value & 0x01) this.direction |= 1 << bit;
          else this.direction &= ~(1 << bit) & 0xff;
        }
        return;
      default:
        return; // ports A and B are the connectors' inputs
    }
  }

  /**
   * Reset the chip, not the socket. The direction latch is the 8255's and goes
   * with it, but the joystick is the host's - resetting the computer does not
   * unplug the stick the user is holding, and clearing it here would drop the
   * controller's state on every `loadProgram`.
   */
  reset(): void {
    this.direction = 0;
  }
}
