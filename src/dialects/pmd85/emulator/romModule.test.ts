// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MONITOR_SIZE, splitRomImage } from '../romImage';
import {
  CONTROL_WORD,
  PORT_ADDRESS_HIGH,
  PORT_ADDRESS_LOW,
  PORT_CONTROL,
  PORT_DATA,
  Pmd85RomModule,
} from './romModule';

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../../public/roms/pmd85/pmd85.rom')),
);

/** Point the module's address ports at `address`, as the Monitor would. */
function select(module: Pmd85RomModule, address: number): void {
  module.writePort(PORT_ADDRESS_LOW, address & 0xff);
  module.writePort(PORT_ADDRESS_HIGH, (address >> 8) & 0xff);
}

describe('pmd85 ROM module', () => {
  it('serves the byte at the address on ports B and C', () => {
    const { romModule } = splitRomImage(rom);
    const module = new Pmd85RomModule(romModule);
    module.writePort(PORT_CONTROL, CONTROL_WORD);

    select(module, 0x0000);
    expect(module.readPort(PORT_DATA)).toBe(0xcd); // the auto-launch byte
    select(module, 0x0002);
    expect(module.readPort(PORT_DATA)).toBe(0x8c);
    select(module, 0x1234);
    expect(module.readPort(PORT_DATA)).toBe(romModule[0x1234]);
  });

  it('reads its address ports back as latches, which is what carries a transfer', () => {
    // The Monitor's TRANSFER loop advances the address with
    // IN A,($F9) / INC A / OUT ($F9),A, carrying into port C on the wrap. Both
    // of those ports are outputs, so a model that answered them with anything
    // but their own latch would lose the address on the first carry.
    const module = new Pmd85RomModule(Uint8Array.of(1, 2, 3));
    module.writePort(PORT_CONTROL, CONTROL_WORD);
    module.writePort(PORT_ADDRESS_LOW, 0xff);
    module.writePort(PORT_ADDRESS_HIGH, 0x01);

    expect(module.readPort(PORT_ADDRESS_LOW)).toBe(0xff);
    expect(module.readPort(PORT_ADDRESS_HIGH)).toBe(0x01);
    expect(module.address).toBe(0x01ff);
  });

  it('deselects on port C bit 7, which is how the Monitor parks it', () => {
    const module = new Pmd85RomModule(Uint8Array.of(0xaa, 0xbb));
    module.writePort(PORT_CONTROL, CONTROL_WORD);

    select(module, 0x0001);
    expect(module.readPort(PORT_DATA)).toBe(0xbb);

    // TRANSFER ends with OUT ($FA),0xFF - the chip select, not an address.
    module.writePort(PORT_ADDRESS_HIGH, 0xff);
    expect(module.selected).toBe(false);
    expect(module.readPort(PORT_DATA)).toBe(0xff);
  });

  it('floats past the end of the module', () => {
    // TRANSFER moves one byte more than it is asked for, so the boot transfer
    // reads exactly one address past a 9K module. It has to answer, not throw.
    const { romModule } = splitRomImage(rom);
    const module = new Pmd85RomModule(romModule);
    module.writePort(PORT_CONTROL, CONTROL_WORD);

    select(module, romModule.length - 1);
    expect(module.readPort(PORT_DATA)).toBe(romModule[romModule.length - 1]);
    select(module, romModule.length);
    expect(module.readPort(PORT_DATA)).toBe(0xff);
  });

  it('takes a bit set/reset on the control port as well as a mode word', () => {
    const module = new Pmd85RomModule(Uint8Array.of(7));
    select(module, 0x0080);

    module.writePort(PORT_CONTROL, 0x0f); // set port C bit 7: deselect
    expect(module.selected).toBe(false);
    module.writePort(PORT_CONTROL, 0x0e); // and clear it again
    expect(module.selected).toBe(true);

    module.writePort(PORT_CONTROL, CONTROL_WORD); // a mode word clears the latches
    expect(module.address).toBe(0);
  });

  it('is absent when no module image was supplied', () => {
    const module = new Pmd85RomModule(new Uint8Array(0));
    expect(module.present).toBe(false);
    expect(module.readPort(PORT_DATA)).toBe(0xff);
  });

  it('carries the whole BASIC-G image behind the four ports', () => {
    // The module is 9K of interpreter reachable only a byte at a time; nothing
    // of it is in the CPU's address space. Read the lot back through the ports.
    const { romModule } = splitRomImage(rom);
    const module = new Pmd85RomModule(romModule);
    module.writePort(PORT_CONTROL, CONTROL_WORD);

    const copy = new Uint8Array(romModule.length);
    for (let i = 0; i < copy.length; i++) {
      select(module, i);
      copy[i] = module.readPort(PORT_DATA);
    }
    expect(copy).toEqual(rom.subarray(MONITOR_SIZE));
  });
});
