import { describe, it, expect } from 'vitest';
import {
  LMPR_ROM0_OFF,
  LMPR_ROM1,
  LMPR_WPROT,
  PAGE_BYTES,
  RAM_BYTES,
  ROM_BYTES,
  SamMemory,
} from './memory';

/** A ROM whose every byte says which half of the image it came from. */
function markedRom(): Uint8Array {
  const rom = new Uint8Array(ROM_BYTES);
  rom.fill(0xa0, 0, PAGE_BYTES); // ROM0
  rom.fill(0xa1, PAGE_BYTES); // ROM1
  return rom;
}

describe('samcoupe memory', () => {
  it('maps the four sections from LMPR and HMPR', () => {
    const mem = new SamMemory(markedRom());
    mem.clearRam();
    // Reset state: ROM0 at the bottom, RAM everywhere above it, no ROM1.
    mem.lmpr = 0;
    mem.hmpr = 0;
    expect([0, 1, 2, 3].map((s) => mem.sectionPage(s))).toEqual([-1, 1, 0, 1]);
    expect(mem.peek(0x0000)).toBe(0xa0);

    // What the ROM itself runs with: page 31 in the LMPR field, which puts
    // page 0 in section B - where the system variables live - and ROM1 back
    // at the top.
    mem.lmpr = 0x1f | LMPR_ROM1;
    mem.hmpr = 5;
    expect([0, 1, 2, 3].map((s) => mem.sectionPage(s))).toEqual([-1, 0, 5, -1]);
    expect(mem.peek(0xc000)).toBe(0xa1);

    // With ROM1 off, section D is the page above section C's.
    mem.lmpr = 0x1f;
    expect(mem.sectionPage(3)).toBe(6);

    // Both ROMs paged out: 64K of RAM, which is what BASIC uses the space for.
    mem.lmpr = 4 | LMPR_ROM0_OFF;
    expect([0, 1, 2, 3].map((s) => mem.sectionPage(s))).toEqual([4, 5, 5, 6]);
  });

  it('wraps the page field at 32 and keeps unfitted pages unwritable', () => {
    const mem = new SamMemory(markedRom());
    mem.clearRam();
    expect(mem.ram.length).toBe(RAM_BYTES);

    // The page field is five bits wide however much RAM is fitted, so page 31
    // is followed by page 0.
    mem.lmpr = 0x1f | LMPR_ROM0_OFF;
    expect(mem.sectionPage(1)).toBe(0);

    // A standard machine fits sixteen pages. The rest are addressable and read
    // 0xFF with writes discarded, which is exactly how the ROM sizes the
    // machine: it walks the pages writing 0xFF then 0x00 and stops at the
    // first that will not hold the zero.
    mem.hmpr = 16;
    mem.write(0x8000, 0x00);
    expect(mem.peek(0x8000)).toBe(0xff);
    mem.hmpr = 15;
    mem.write(0x8000, 0x00);
    expect(mem.peek(0x8000)).toBe(0x00);
  });

  it('honours the ROM and the write-protect bit', () => {
    const mem = new SamMemory(markedRom());
    mem.clearRam();
    mem.lmpr = LMPR_ROM1;
    mem.write(0x0000, 0x55); // ROM0
    mem.write(0xc000, 0x55); // ROM1
    expect(mem.peek(0x0000)).toBe(0xa0);
    expect(mem.peek(0xc000)).toBe(0xa1);

    // Bit 7 write-protects section A, and only section A.
    mem.lmpr = 4 | LMPR_ROM0_OFF | LMPR_WPROT;
    mem.write(0x0000, 0x55);
    mem.write(0x4000, 0x55);
    expect(mem.peek(0x0000)).not.toBe(0x55);
    expect(mem.peek(0x4000)).toBe(0x55);
  });

  it('rejects a ROM that is not the machine`s own size', () => {
    expect(() => new SamMemory(new Uint8Array(16384))).toThrow(/32768/);
  });
});
