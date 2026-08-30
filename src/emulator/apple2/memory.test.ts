// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { Apple2Memory, type Apple2IoPorts } from './memory';
import { FIRMWARE_BYTES, ROM_BASE } from '../../dialects/apple2/addresses';

/** A recording stand-in for the devices the `$C0xx` groups dispatch to. */
function ports(): Apple2IoPorts & { log: string[]; key: number } {
  const state = {
    log: [] as string[],
    key: 0xc1,
    readKeyboard(): number {
      state.log.push('key');
      return state.key;
    },
    clearKeyStrobe(): void {
      state.log.push('strobe');
      state.key &= 0x7f;
    },
    toggleSpeaker(): void {
      state.log.push('speaker');
    },
    displaySwitch(address: number): void {
      state.log.push(`switch ${address.toString(16)}`);
    },
    readInput(address: number): number {
      state.log.push(`input ${address.toString(16)}`);
      return 0x80;
    },
    triggerPaddles(): void {
      state.log.push('trigger');
    },
  };
  return state;
}

function memory(): { mem: Apple2Memory; io: ReturnType<typeof ports> } {
  const io = ports();
  return { mem: new Apple2Memory(io), io };
}

describe('Apple2Memory', () => {
  it('lays the firmware image across the whole ROM window', () => {
    const { mem } = memory();
    const rom = new Uint8Array(FIRMWARE_BYTES).fill(0xa5);
    rom[0] = 0x11;
    rom[FIRMWARE_BYTES - 1] = 0x22;
    mem.loadFirmware(rom);
    expect(mem.read(ROM_BASE)).toBe(0x11);
    expect(mem.read(0xffff)).toBe(0x22);
    // Mask ROM: a write to it is ignored rather than banked out of the way.
    mem.write(ROM_BASE, 0x99);
    expect(mem.read(ROM_BASE)).toBe(0x11);
  });

  it('reads and writes the 48K of RAM', () => {
    const { mem } = memory();
    mem.write(0x0000, 0x12);
    mem.write(0xbfff, 0x34);
    expect(mem.read(0x0000)).toBe(0x12);
    expect(mem.read(0xbfff)).toBe(0x34);
  });

  it('dispatches each $C0xx group, on a write as well as a read', () => {
    const { mem, io } = memory();
    expect(mem.read(0xc000)).toBe(0xc1);
    mem.read(0xc030);
    mem.write(0xc030, 0);
    mem.read(0xc054);
    mem.write(0xc057, 0);
    mem.read(0xc064);
    mem.write(0xc070, 0);
    expect(io.log).toEqual([
      'key',
      'speaker',
      'speaker',
      'switch c054',
      'switch c057',
      'input c064',
      'trigger',
    ]);
  });

  it('repeats each device across its sixteen addresses', () => {
    const { mem, io } = memory();
    // A0-A3 reach nothing: the group is picked by A4-A6 alone, which is why
    // `BIT $C01F` clears the strobe exactly as `BIT $C010` does.
    mem.read(0xc00f);
    mem.read(0xc01f);
    mem.read(0xc03f);
    expect(io.log).toEqual(['key', 'strobe', 'key', 'speaker']);
  });

  it('hands back the latch with the strobe gone when $C010 clears it', () => {
    const { mem } = memory();
    expect(mem.read(0xc010)).toBe(0x41);
  });

  it('reads unfitted space as a floating bus', () => {
    const { mem, io } = memory();
    // Card ROM space, with no card in any slot.
    expect(mem.read(0xc100)).toBe(0xff);
    expect(mem.read(0xcfff)).toBe(0xff);
    // A write-only switch has nothing to answer with.
    expect(mem.read(0xc050)).toBe(0xff);
    expect(io.log).toEqual(['switch c050']);
  });

  it('peeks and pokes without touching the I/O page', () => {
    const { mem, io } = memory();
    expect(mem.peek(0xc000)).toBe(0xff);
    expect(mem.peek(0xc030)).toBe(0xff);
    mem.poke(0xc030, 0);
    mem.poke(0xc050, 0);
    expect(io.log).toEqual([]);
    // ...and a host poke into ROM is ignored just as a bus write is.
    mem.loadFirmware(new Uint8Array(FIRMWARE_BYTES).fill(0x5a));
    mem.poke(ROM_BASE, 0x00);
    expect(mem.peek(ROM_BASE)).toBe(0x5a);
  });

  it('reads and writes little-endian pointers', () => {
    const { mem } = memory();
    mem.pokeWord(0x004c, 0xc000);
    expect(mem.peek(0x004c)).toBe(0x00);
    expect(mem.peek(0x004d)).toBe(0xc0);
    expect(mem.peekWord(0x004c)).toBe(0xc000);
    expect(mem.readWord(0x004c)).toBe(0xc000);
  });
});
