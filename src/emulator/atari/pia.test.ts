// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { Pia } from './pia';
import type { JoystickState } from '../../dialects/types';

/** Register offsets within the PIA's page. */
const PORTA = 0x00;
const PORTB = 0x01;
const PACTL = 0x02;
const PBCTL = 0x03;

/** Control register bit 2: 1 selects the port, 0 the direction register. */
const PORT_SELECT = 0x04;

const centred = (over: Partial<JoystickState> = {}): JoystickState => ({
  up: false,
  down: false,
  left: false,
  right: false,
  fire1: false,
  fire2: false,
  ...over,
});

describe('the PIA', () => {
  it('reads the direction register until bit 2 says otherwise', () => {
    const pia = new Pia();
    // This is the sequence the OS runs at power-on to make both ports inputs.
    pia.write(PACTL, 0x00);
    pia.write(PORTA, 0x00);
    expect(pia.read(PORTA)).toBe(0x00);
    pia.write(PACTL, PORT_SELECT);
    expect(pia.read(PORTA)).toBe(0xff);
  });

  it('puts each stick on its own nibble, active low', () => {
    const pia = new Pia();
    pia.write(PACTL, PORT_SELECT);
    expect(pia.read(PORTA)).toBe(0xff);

    pia.setJoystick(0, centred({ up: true, right: true }));
    // Up is bit 0 and right is bit 3, both pulled low.
    expect(pia.read(PORTA)).toBe(0xf6);

    pia.setJoystick(1, centred({ down: true }));
    expect(pia.read(PORTA)).toBe(0xd6);

    pia.setJoystick(0, null);
    expect(pia.read(PORTA)).toBe(0xdf);
  });

  it('leaves the two ports nothing is plugged into reading high', () => {
    const pia = new Pia();
    pia.write(PBCTL, PORT_SELECT);
    expect(pia.read(PORTB)).toBe(0xff);
  });

  it('reports the serial bus COMMAND line, and only when it changes', () => {
    const seen: boolean[] = [];
    const pia = new Pia((asserted) => seen.push(asserted));
    // The OS drives PBCTL bit 3 low to mark out a command frame.
    pia.write(PBCTL, 0x3c);
    pia.write(PBCTL, 0x34);
    pia.write(PBCTL, 0x34);
    pia.write(PBCTL, 0x3c);
    expect(seen).toEqual([true, false]);
  });
});
