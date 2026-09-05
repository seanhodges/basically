// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  Pmd85Gpio,
  PORT_CONTROL,
  PORT_DIRECTION,
  PORT_GPIO0,
  PORT_GPIO1,
} from './gpio';
import { splitRomImage } from '../romImage';
import { tokenizeProgram } from '../tokenizer';
import { Pmd85Machine } from './pmd85Machine';
import type { JoystickState } from '../../types';

const RELEASED: JoystickState = {
  up: false,
  down: false,
  left: false,
  right: false,
  fire1: false,
  fire2: false,
};

/** Turn GPIO0's buffer inward, the way the documented setup does. */
function armGpio0(gpio: Pmd85Gpio): void {
  gpio.writePort(PORT_DIRECTION & 0x03, 0x11);
}

describe('pmd85 GPIO 8255', () => {
  it('answers on the four addresses MAME’s I/O map gives it', () => {
    // Named here so the wiring in pmd85Machine.ts cannot drift from the chip.
    expect([PORT_GPIO0, PORT_GPIO1, PORT_DIRECTION, PORT_CONTROL]).toEqual([
      0x4c, 0x4d, 0x4e, 0x4f,
    ]);
  });

  it('reports the stick’s switches active low', () => {
    const gpio = new Pmd85Gpio();
    armGpio0(gpio);

    gpio.setJoystick(RELEASED);
    expect(gpio.readPort(0)).toBe(0xff);

    gpio.setJoystick({ ...RELEASED, down: true });
    expect(gpio.readPort(0)).toBe(0xfe);
    gpio.setJoystick({ ...RELEASED, up: true });
    expect(gpio.readPort(0)).toBe(0xfd);
    gpio.setJoystick({ ...RELEASED, right: true });
    expect(gpio.readPort(0)).toBe(0xfb);
    gpio.setJoystick({ ...RELEASED, left: true });
    expect(gpio.readPort(0)).toBe(0xf7);
    gpio.setJoystick({ ...RELEASED, fire1: true });
    expect(gpio.readPort(0)).toBe(0xef);

    // A diagonal is two switches, and the documented read masks to five bits.
    gpio.setJoystick({ ...RELEASED, up: true, left: true, fire1: true });
    expect(~gpio.readPort(0) & 0x1f).toBe(0x02 | 0x08 | 0x10);
  });

  it('works the one fire line from either button', () => {
    // The 4004/482 has a single fire switch, so a two-button pad's second
    // button would otherwise do nothing at all.
    const gpio = new Pmd85Gpio();
    armGpio0(gpio);
    gpio.setJoystick({ ...RELEASED, fire2: true });
    expect(gpio.readPort(0)).toBe(0xef);
  });

  it('reads nothing until the connector’s buffer is turned inward', () => {
    // The MH8286 driver has to be pointed at the machine first. Until it is,
    // the stick is not connected to the port, whatever it is doing.
    const gpio = new Pmd85Gpio();
    gpio.setJoystick({ ...RELEASED, fire1: true, left: true });
    expect(gpio.readPort(0)).toBe(0xff);
    armGpio0(gpio);
    expect(gpio.readPort(0)).toBe(0xe7);
  });

  it('leaves GPIO1 reading as an empty socket', () => {
    const gpio = new Pmd85Gpio();
    gpio.writePort(PORT_DIRECTION & 0x03, 0x11);
    gpio.setJoystick({ ...RELEASED, up: true });
    expect(gpio.readPort(1)).toBe(0xff);
  });

  it('reads the direction latch back, and takes it a bit at a time', () => {
    const gpio = new Pmd85Gpio();
    // Bit set/reset: set PC4 alone, which is GPIO0's buffer and nothing else.
    gpio.writePort(3, 0x09);
    expect(gpio.readPort(2)).toBe(0x10);
    gpio.setJoystick({ ...RELEASED, right: true });
    expect(gpio.readPort(0)).toBe(0xfb);
    // …and clearing it again disconnects the stick.
    gpio.writePort(3, 0x08);
    expect(gpio.readPort(2)).toBe(0x00);
    expect(gpio.readPort(0)).toBe(0xff);
    // A mode word clears the whole latch.
    gpio.writePort(2, 0x11);
    gpio.writePort(3, 0x80);
    expect(gpio.readPort(2)).toBe(0x00);
  });
});

describe('pmd85 joystick from BASIC-G', () => {
  const rom = new Uint8Array(
    readFileSync(join(__dirname, '../../../../public/roms/pmd85/pmd85.rom')),
  );

  it('reads the stick through INP after the documented setup', () => {
    // BASIC-G has no joystick keyword, so `OUT` and `INP` are the only way a
    // program can see the stick - and the reason the machine models the
    // connector at all. 79 and 78 are the 8255's mode and port C, 76 its port
    // A: a mode word, the buffer turned inward, then the read.
    const pmd = new Pmd85Machine(splitRomImage(rom));
    const { program, errors } = tokenizeProgram(
      '10 OUT 79,146\n20 OUT 78,17\n30 J=INP(76)\n40 END\n',
    );
    expect(errors).toEqual([]);
    // Before loadProgram, which boots the machine and runs the program in one
    // go - a stick plugged in afterwards would not be there when line 30 ran.
    pmd.setJoystick('native', { ...RELEASED, up: true, fire1: true });
    pmd.loadProgram(program);
    for (let f = 0; f < 400 && pmd.isProgramRunning(); f++) pmd.runFrame();

    expect(pmd.readReport()?.isError).toBe(false);
    const vars = new Map(pmd.readVariables().map((v) => [v.name, v.value]));
    // Up is bit 1 and fire is bit 4, both active low: ~0x12 = 0xED.
    expect(vars.get('J')).toBe('237');
  });

  it('survives the reset inside loadProgram with the stick still plugged in', () => {
    // Resetting the computer does not unplug the controller the user is
    // holding; only the 8255's own direction latch goes.
    const pmd = new Pmd85Machine(splitRomImage(rom));
    const { program } = tokenizeProgram('10 OUT 78,17\n20 J=INP(76)\n30 END\n');
    pmd.setJoystick('native', { ...RELEASED, left: true });
    pmd.loadProgram(program);
    for (let f = 0; f < 400 && pmd.isProgramRunning(); f++) pmd.runFrame();
    const vars = new Map(pmd.readVariables().map((v) => [v.name, v.value]));
    expect(vars.get('J')).toBe('247');
  });
});
