import { describe, expect, it } from 'vitest';
import { CpcMemory, CPC_ROM_SIZE, SCREEN_BASE } from './memory';

/** A 32K ROM whose lower half is 0xAA and upper half is 0x55, for overlay tests. */
function testRom(): Uint8Array {
  const rom = new Uint8Array(CPC_ROM_SIZE);
  rom.fill(0xaa, 0x0000, 0x4000); // lower / OS
  rom.fill(0x55, 0x4000, 0x8000); // upper / BASIC
  return rom;
}

describe('CpcMemory ROM overlay', () => {
  it('reads the lower ROM over &0000–&3FFF while enabled', () => {
    const mem = new CpcMemory(testRom());
    mem.ram[0x0000] = 0x11;
    mem.ram[0x3fff] = 0x22;
    expect(mem.read(0x0000)).toBe(0xaa);
    expect(mem.read(0x3fff)).toBe(0xaa);
    // &4000 is always RAM.
    mem.ram[0x4000] = 0x33;
    expect(mem.read(0x4000)).toBe(0x33);
  });

  it('reads the upper ROM over &C000–&FFFF while enabled', () => {
    const mem = new CpcMemory(testRom());
    mem.ram[0xc000] = 0x11;
    mem.ram[0xffff] = 0x22;
    expect(mem.read(0xc000)).toBe(0x55);
    expect(mem.read(0xffff)).toBe(0x55);
  });

  it('falls through to RAM once an overlay is disabled', () => {
    const mem = new CpcMemory(testRom());
    mem.ram[0x0000] = 0x11;
    mem.ram[0xc000] = 0x22;
    mem.setRomEnables(false, false); // both overlays off
    expect(mem.read(0x0000)).toBe(0x11);
    expect(mem.read(0xc000)).toBe(0x22);
  });

  it('enables each overlay independently', () => {
    const mem = new CpcMemory(testRom());
    mem.ram[0x0000] = 0x11;
    mem.ram[0xc000] = 0x22;
    mem.setRomEnables(false, true); // lower off, upper on
    expect(mem.read(0x0000)).toBe(0x11); // RAM
    expect(mem.read(0xc000)).toBe(0x55); // ROM
  });
});

describe('CpcMemory writes', () => {
  it('writes through to RAM even where a ROM overlay is active', () => {
    const mem = new CpcMemory(testRom());
    // BASIC ROM is paged in over the screen, but the firmware still writes it.
    mem.write(SCREEN_BASE, 0x99);
    expect(mem.readScreen(SCREEN_BASE)).toBe(0x99); // landed in RAM
    expect(mem.read(SCREEN_BASE)).toBe(0x55); // read still returns ROM
    mem.setRomEnables(true, false); // page BASIC out
    expect(mem.read(SCREEN_BASE)).toBe(0x99); // now the RAM write shows through
  });

  it('round-trips words little-endian', () => {
    const mem = new CpcMemory(testRom());
    mem.writeWord(0x8000, 0x1234);
    expect(mem.ram[0x8000]).toBe(0x34);
    expect(mem.ram[0x8001]).toBe(0x12);
    expect(mem.readWord(0x8000)).toBe(0x1234);
  });
});

describe('CpcMemory reset + paging', () => {
  it('re-enables both overlays on resetPaging', () => {
    const mem = new CpcMemory(testRom());
    mem.setRomEnables(false, false);
    mem.resetPaging();
    expect(mem.read(0x0000)).toBe(0xaa);
    expect(mem.read(0xc000)).toBe(0x55);
  });

  it('clears RAM without disturbing the ROMs', () => {
    const mem = new CpcMemory(testRom());
    mem.ram.fill(0x7f);
    mem.clearRam();
    expect(mem.ram[0x4000]).toBe(0x00);
    expect(mem.read(0x0000)).toBe(0xaa); // lower ROM intact
  });

  it('records reads and writes only while activity is enabled', () => {
    const mem = new CpcMemory(testRom());
    mem.read(0x4000);
    mem.write(0x4001, 1);
    expect(mem.activity.hits[0x4000]).toBe(0); // off by default
    mem.activity.enabled = true;
    mem.read(0x4000);
    mem.write(0x4001, 1);
    expect(mem.activity.hits[0x4000]! & 1).toBe(1); // read bit
    expect(mem.activity.hits[0x4001]! & 2).toBe(2); // write bit
  });
});
