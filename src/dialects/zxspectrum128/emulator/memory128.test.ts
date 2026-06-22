import { describe, expect, it } from 'vitest';
import { Spectrum128Memory } from './memory128';

/** A 32K dual ROM filled so bank 0 reads 0xA0 and bank 1 reads 0xB1. */
function makeRom(): Uint8Array {
  const rom = new Uint8Array(0x8000);
  rom.fill(0xa0, 0x0000, 0x4000); // ROM 0 (128 editor)
  rom.fill(0xb1, 0x4000, 0x8000); // ROM 1 (48 BASIC)
  return rom;
}

describe('Spectrum128Memory', () => {
  it('rejects a ROM that is not 32K', () => {
    expect(() => new Spectrum128Memory(new Uint8Array(16384))).toThrow(/32768/);
  });

  it('boots with bank 0 paged, screen 5, the 128 editor ROM', () => {
    const mem = new Spectrum128Memory(makeRom());
    expect(mem.currentRomBank).toBe(0);
    expect(mem.displayedScreenBank).toBe(5);
    expect(mem.read(0x0000)).toBe(0xa0); // ROM 0
  });

  it('selects the 48 BASIC ROM via bit 4 of 0x7FFD', () => {
    const mem = new Spectrum128Memory(makeRom());
    mem.writePort7ffd(0x10); // bit 4 set
    expect(mem.currentRomBank).toBe(1);
    expect(mem.read(0x0000)).toBe(0xb1); // ROM 1
  });

  it('keeps bank 5 at 0x4000 and bank 2 at 0x8000 regardless of paging', () => {
    const mem = new Spectrum128Memory(makeRom());
    mem.write(0x4000, 0x55); // bank 5
    mem.write(0x8000, 0x22); // bank 2
    mem.writePort7ffd(0x03); // page bank 3 at 0xC000
    expect(mem.read(0x4000)).toBe(0x55);
    expect(mem.read(0x8000)).toBe(0x22);
  });

  it('pages RAM banks 0-7 at 0xC000', () => {
    const mem = new Spectrum128Memory(makeRom());
    // Write a distinct marker into each bank through the 0xC000 window.
    for (let bank = 0; bank < 8; bank++) {
      mem.writePort7ffd(bank);
      mem.write(0xc000, 0xe0 + bank);
    }
    for (let bank = 0; bank < 8; bank++) {
      mem.writePort7ffd(bank);
      expect(mem.read(0xc000)).toBe(0xe0 + bank);
    }
  });

  it('aliases bank 5 (0x4000) and bank 5 paged at 0xC000', () => {
    const mem = new Spectrum128Memory(makeRom());
    mem.write(0x4000, 0x77);
    mem.writePort7ffd(0x05); // page bank 5 at 0xC000 too
    expect(mem.read(0xc000)).toBe(0x77);
  });

  it('renders the shadow screen (bank 7) when bit 3 is set', () => {
    const mem = new Spectrum128Memory(makeRom());
    // Normal screen lives in bank 5 (0x4000); shadow in bank 7.
    mem.write(0x4000, 0x11); // bank 5 screen byte
    mem.writePort7ffd(0x07); // page bank 7 at 0xC000 to write its screen
    mem.write(0xc000, 0x99); // bank 7 offset 0 == shadow screen byte
    // Bit 3 still clear: the ULA shows bank 5.
    expect(mem.displayedScreenBank).toBe(5);
    expect(mem.readScreen(0x4000)).toBe(0x11);
    // Set bit 3 (0x08): the ULA shows the shadow screen in bank 7.
    mem.writePort7ffd(0x0f); // bit 3 set, still paging bank 7
    expect(mem.displayedScreenBank).toBe(7);
    expect(mem.readScreen(0x4000)).toBe(0x99); // shadow byte
    mem.writePort7ffd(0x00); // back to the normal screen
    expect(mem.readScreen(0x4000)).toBe(0x11);
  });

  it('freezes paging once the lock bit (bit 5) is set, until reset', () => {
    const mem = new Spectrum128Memory(makeRom());
    mem.writePort7ffd(0x20 | 0x10 | 0x02); // lock + ROM 1 + bank 2
    expect(mem.currentRomBank).toBe(1);
    mem.writePort7ffd(0x00); // ignored while locked
    expect(mem.currentRomBank).toBe(1);
    mem.clearRam(); // reset releases the lock and restores power-on paging
    expect(mem.currentRomBank).toBe(0);
    mem.writePort7ffd(0x10);
    expect(mem.currentRomBank).toBe(1);
  });

  it('reads and writes words little-endian and treats ROM as read-only', () => {
    const mem = new Spectrum128Memory(makeRom());
    mem.writeWord(0x6000, 0x1234);
    expect(mem.read(0x6000)).toBe(0x34);
    expect(mem.read(0x6001)).toBe(0x12);
    expect(mem.readWord(0x6000)).toBe(0x1234);
    mem.write(0x0000, 0x00); // ROM ignores writes
    expect(mem.read(0x0000)).toBe(0xa0);
  });
});
