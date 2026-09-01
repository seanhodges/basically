import { describe, expect, it } from 'vitest';
import { MsxSlots, SYSTEM_ROM_BYTES } from './slots';
import type { MsxModel } from './model';

const HB10P: MsxModel = {
  ramKb: 64,
  ramSlot: 3,
  region: 'pal',
  vdp: 't6950',
  keyboardId: 'international',
  slot0Page3: 'ram-mirror',
};

/** A ROM whose every byte says which page it is in, so a read names its page. */
function markedRom(): Uint8Array {
  const rom = new Uint8Array(SYSTEM_ROM_BYTES);
  for (let i = 0; i < rom.length; i++) rom[i] = 0xa0 + (i >> 14);
  return rom;
}

/** The slot-register value putting `slot` in every page. */
const allPages = (slot: number): number => slot * 0b01010101;

describe('MsxSlots', () => {
  it('reads the system ROM in slot 0 and nothing above it', () => {
    const slots = new MsxSlots(markedRom(), { ...HB10P, slot0Page3: 'empty' });
    slots.reset();
    expect(slots.read(0x0000)).toBe(0xa0);
    expect(slots.read(0x3fff)).toBe(0xa0);
    expect(slots.read(0x4000)).toBe(0xa1);
    expect(slots.read(0x7fff)).toBe(0xa1);
    // Pages 2 and 3 hold nothing in slot 0 on an ordinary MSX, and an unfitted
    // slot floats the bus high rather than reading as zero.
    expect(slots.read(0x8000)).toBe(0xff);
    expect(slots.read(0xc000)).toBe(0xff);
  });

  it('gives each page the slot the register names, two bits at a time', () => {
    const slots = new MsxSlots(markedRom(), HB10P);
    slots.reset();
    // Page 0 and 1 on slot 0 (ROM), page 2 and 3 on slot 3 (RAM).
    slots.selectSlots(0b11110000);
    expect(slots.slotRegister()).toBe(0b11110000);
    slots.write(0x8000, 0x42);
    slots.write(0xc000, 0x43);
    expect(slots.read(0x0000)).toBe(0xa0);
    expect(slots.read(0x8000)).toBe(0x42);
    expect(slots.read(0xc000)).toBe(0x43);

    // Point page 0 at RAM instead and the ROM is gone from under it.
    slots.selectSlots(0b11110011);
    slots.write(0x0000, 0x44);
    expect(slots.read(0x0000)).toBe(0x44);
    slots.selectSlots(0b11110000);
    expect(slots.read(0x0000)).toBe(0xa0);
  });

  it('drops a write to ROM and to an empty slot', () => {
    const slots = new MsxSlots(markedRom(), HB10P);
    slots.reset();
    slots.selectSlots(0); // every page on slot 0
    slots.write(0x0000, 0x99);
    expect(slots.read(0x0000)).toBe(0xa0);
    slots.selectSlots(allPages(1)); // every page on the empty cartridge slot 1
    slots.write(0x4000, 0x99);
    expect(slots.read(0x4000)).toBe(0xff);
  });

  it('answers page 3 of slot 0 with the main RAM on a mirroring machine', () => {
    const slots = new MsxSlots(markedRom(), HB10P);
    slots.reset();
    slots.selectSlots(0b11000000); // page 3 on slot 3, the rest on slot 0
    slots.write(0xf000, 0x5a);
    // The same byte through slot 0's page 3, which is the decoding shortcut the
    // BIOS finds during its slot search and then runs the machine's stack on.
    slots.selectSlots(0b00000000);
    expect(slots.read(0xf000)).toBe(0x5a);
    slots.write(0xf001, 0x5b);
    slots.selectSlots(0b11000000);
    expect(slots.read(0xf001)).toBe(0x5b);
  });

  it('reads RAM by address whatever the slot register says', () => {
    const slots = new MsxSlots(markedRom(), HB10P);
    slots.reset();
    slots.selectSlots(allPages(3));
    slots.writeRamWord(0x9000, 0xbeef);
    slots.selectSlots(0); // the CPU now sees ROM and open bus, not RAM
    expect(slots.read(0x9000)).toBe(0xff);
    expect(slots.readRam(0x9000)).toBe(0xef);
    expect(slots.readRamWord(0x9000)).toBe(0xbeef);
  });

  it('reports open bus off the RAM a smaller machine fits', () => {
    // A 16KB machine has RAM only in page 3, and a read below it must not wrap
    // round to the top of the array.
    const slots = new MsxSlots(markedRom(), { ...HB10P, ramKb: 16 });
    slots.reset();
    slots.selectSlots(allPages(3));
    slots.write(0xc000, 0x11);
    expect(slots.read(0xc000)).toBe(0x11);
    expect(slots.read(0x8000)).toBe(0xff);
    slots.write(0x8000, 0x22);
    expect(slots.read(0xc000)).toBe(0x11);
  });
});
