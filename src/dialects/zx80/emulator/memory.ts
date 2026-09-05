import {
  MemoryActivityBuffer,
  READ_BIT,
  WRITE_BIT,
} from '../../../emulator/memoryActivityBuffer';

/**
 * ZX80 memory map:
 *   0x0000-0x0FFF  4K ROM
 *   0x1000-0x3FFF  ROM mirror (the ZX80 ROM is a quarter the ZX81's size)
 *   0x4000-...     RAM (the original machine had 1K; we give it 16/32/64K)
 *   0x8000-0xFFFF  echo of 0x0000-0x7FFF (the region the display routine
 *                  "executes"; see the opcode-fetch hook in zx80Machine)
 */
/** Size of the ZX80's 4K ROM image; the memory map's ROM region matches it. */
export const ROM_BYTES = 4096;

export class Zx80Memory {
  readonly rom: Uint8Array;
  readonly ram: Uint8Array;
  private readonly ramMask: number;
  /**
   * Live memory-activity recorder for the memory-map overlay. Disabled by
   * default; the host arms it only while the map is on screen. When enabled,
   * `read`/`write` stamp the touched CPU address with a single indexed `|=`.
   */
  readonly activity = new MemoryActivityBuffer(0x10000);

  constructor(rom: Uint8Array, ramKb: 16 | 32 | 64) {
    // Empty is the documented "no firmware to run" state, the same carve-out
    // the CPC memory makes: images with no redistribution grant are meant to be
    // removable (public/roms/ATTRIBUTION.md), and a machine given none has to
    // construct so that the layer above can say so rather than dying inside a
    // constructor. Any other wrong length is still refused - that is a caller
    // handing over the wrong file, and a partly-filled ROM boots to a dead
    // machine with nothing to explain it.
    if (rom.length !== 0 && rom.length !== ROM_BYTES)
      throw new Error(`ZX80 ROM must be ${ROM_BYTES} bytes, got ${rom.length}`);
    this.rom = rom.length === ROM_BYTES ? rom : new Uint8Array(ROM_BYTES);
    this.ram = new Uint8Array(ramKb * 1024);
    this.ramMask = ramKb * 1024 - 1;
  }

  read = (address: number): number => {
    if (this.activity.enabled) this.activity.hits[address & 0xffff] |= READ_BIT;
    return this.peek(address);
  };

  /**
   * Read a byte without recording the access. Host-side introspection - the
   * executing BASIC line, and the profiler sampling it on the run hot path -
   * reads through this, so the IDE's own polling never paints the memory-map
   * overlay with activity the program never performed.
   */
  peek = (address: number): number => {
    const addr = address & 0x7fff; // echo region mirrors the lower 32K
    if (addr < 0x4000) return this.rom[addr & 0x0fff]!;
    return this.ram[(addr - 0x4000) & this.ramMask]!;
  };

  write = (address: number, value: number): void => {
    if (this.activity.enabled)
      this.activity.hits[address & 0xffff] |= WRITE_BIT;
    const addr = address & 0x7fff;
    if (addr < 0x4000) return; // ROM
    this.ram[(addr - 0x4000) & this.ramMask] = value & 0xff;
  };

  readWord(addr: number): number {
    return this.read(addr) | (this.read(addr + 1) << 8);
  }

  /** {@link readWord} through {@link peek}: no activity recorded. */
  rawReadWord(addr: number): number {
    return this.peek(addr) | (this.peek(addr + 1) << 8);
  }
}
