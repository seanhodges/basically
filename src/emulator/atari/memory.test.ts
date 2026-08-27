import { describe, expect, it } from 'vitest';
import { AtariMemory, type AtariChips } from './memory';
import {
  ATARI_400_RAM_TOP,
  ATARI_800_RAM_TOP,
  ATARI_ROM_BYTES,
  BASIC_CARTRIDGE_BASE,
  OS_ROM_BASE,
  OS_ROM_BYTES,
} from '../../dialects/atari800/addresses';

/** A firmware image whose two halves are distinguishable from each other. */
function firmware(): Uint8Array {
  const rom = new Uint8Array(ATARI_ROM_BYTES);
  rom.fill(0xaa, 0, OS_ROM_BYTES);
  rom.fill(0x55, OS_ROM_BYTES);
  return rom;
}

/** Chip stubs that record what the bus dispatched to them. */
function chips(): { log: string[]; chips: AtariChips } {
  const log: string[] = [];
  const make = (name: string) => ({
    read: (reg: number) => {
      log.push(`${name} read ${reg}`);
      return 0x11;
    },
    write: (reg: number, value: number) => {
      log.push(`${name} write ${reg} ${value}`);
    },
  });
  const gtia = make('gtia');
  const pokey = make('pokey');
  const pia = make('pia');
  const antic = make('antic');
  return {
    log,
    chips: {
      readGtia: gtia.read,
      writeGtia: gtia.write,
      readPokey: pokey.read,
      writePokey: pokey.write,
      readPia: pia.read,
      writePia: pia.write,
      readAntic: antic.read,
      writeAntic: antic.write,
    },
  };
}

describe('the Atari bus', () => {
  it('lays the two ROM halves where each belongs', () => {
    const memory = new AtariMemory(ATARI_800_RAM_TOP);
    memory.loadFirmware(firmware());
    const bus = memory.makeBus(chips().chips);
    expect(bus.read(OS_ROM_BASE)).toBe(0xaa);
    expect(bus.read(0xffff)).toBe(0xaa);
    expect(bus.read(BASIC_CARTRIDGE_BASE)).toBe(0x55);
    expect(bus.read(0xbfff)).toBe(0x55);
  });

  it('ignores writes to either ROM', () => {
    const memory = new AtariMemory(ATARI_800_RAM_TOP);
    memory.loadFirmware(firmware());
    const bus = memory.makeBus(chips().chips);
    bus.write(BASIC_CARTRIDGE_BASE, 0x00);
    bus.write(OS_ROM_BASE, 0x00);
    expect(bus.read(BASIC_CARTRIDGE_BASE)).toBe(0x55);
    expect(bus.read(OS_ROM_BASE)).toBe(0xaa);
  });

  it('reads a floating bus where nothing is fitted', () => {
    // A 16K 400 has no RAM between $4000 and the cartridge, and neither machine
    // has anything at $C000 or on the parallel bus at $D100.
    const small = new AtariMemory(ATARI_400_RAM_TOP);
    small.loadFirmware(firmware());
    const bus = small.makeBus(chips().chips);
    expect(bus.read(ATARI_400_RAM_TOP - 1)).toBe(0x00);
    expect(bus.read(ATARI_400_RAM_TOP)).toBe(0xff);
    expect(bus.read(0x8000)).toBe(0xff);
    expect(bus.read(0xc000)).toBe(0xff);
    expect(bus.read(0xd100)).toBe(0xff);

    // And a write there goes nowhere, which is what the OS's power-on memory
    // sizing walks the address space looking for.
    bus.write(0x8000, 0x42);
    expect(bus.read(0x8000)).toBe(0xff);
  });

  it('gives the 800 RAM where the 400 has none', () => {
    const big = new AtariMemory(ATARI_800_RAM_TOP);
    big.loadFirmware(firmware());
    const bus = big.makeBus(chips().chips);
    bus.write(0x8000, 0x42);
    expect(bus.read(0x8000)).toBe(0x42);
  });

  it('sends each hardware page to its own chip, mirrored across the page', () => {
    const memory = new AtariMemory(ATARI_800_RAM_TOP);
    memory.loadFirmware(firmware());
    const { log, chips: stubs } = chips();
    const bus = memory.makeBus(stubs);
    bus.read(0xd000);
    bus.read(0xd0ff); // GTIA has 32 registers, so this is register 31
    bus.write(0xd201, 0x7f);
    bus.read(0xd302);
    bus.write(0xd40a, 0x00);
    expect(log).toEqual([
      'gtia read 0',
      'gtia read 31',
      'pokey write 1 127',
      'pia read 2',
      'antic write 10 0',
    ]);
  });

  it('never asks a chip anything through a peek', () => {
    // The host peeks while the machine is stopped, and a real read of these
    // addresses takes a key out of POKEY's latch or clears ANTIC's interrupt
    // status.
    const memory = new AtariMemory(ATARI_800_RAM_TOP);
    memory.loadFirmware(firmware());
    const { log, chips: stubs } = chips();
    const bus = memory.makeBus(stubs);
    expect(bus.peek(0xd20a)).toBe(0xff);
    expect(bus.peek(0xd40f)).toBe(0xff);
    expect(log).toEqual([]);
    // Everywhere else a peek is a read.
    expect(bus.peek(OS_ROM_BASE)).toBe(0xaa);
  });

  it('leaves both ROMs alone when the RAM is cleared', () => {
    const memory = new AtariMemory(ATARI_800_RAM_TOP);
    memory.loadFirmware(firmware());
    memory.mem[0x1000] = 0x99;
    memory.clearRam();
    expect(memory.mem[0x1000]).toBe(0);
    expect(memory.mem[OS_ROM_BASE]).toBe(0xaa);
    expect(memory.mem[BASIC_CARTRIDGE_BASE]).toBe(0x55);
  });

  it('says which addresses are RAM this machine has', () => {
    expect(new AtariMemory(ATARI_800_RAM_TOP).isRam(0x8000)).toBe(true);
    expect(new AtariMemory(ATARI_400_RAM_TOP).isRam(0x8000)).toBe(false);
  });
});
