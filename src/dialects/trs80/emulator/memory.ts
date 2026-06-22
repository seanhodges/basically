/**
 * TRS-80 Model I memory map:
 *   0x0000-0x2FFF  12K Level II BASIC ROM
 *   0x3000-0x37FF  memory-mapped I/O page (disk/printer; open bus here)
 *   0x3800-0x3BFF  keyboard matrix (read-only; handled in the machine, not here)
 *   0x3C00-0x3FFF  1K video RAM (64×16 character map)
 *   0x4000-...     RAM (the original had 4K/16K; we give it 16/32/48K to 0xFFFF)
 *
 * The keyboard range is intercepted by {@link Trs80Machine}'s bus closure before
 * it reaches here, so reads of 0x3800-0x3BFF in this class return open-bus 0xFF.
 * All TRS-80 I/O is memory-mapped — there is no echo region and no NMI, which
 * makes this the simplest of the Z80 buses in the project.
 */
const ROM_SIZE = 0x3000; // 12K
const VIDEO_BASE = 0x3c00;
const VIDEO_SIZE = 0x0400; // 1K
const RAM_BASE = 0x4000;

export class Trs80Memory {
  readonly rom: Uint8Array;
  readonly ram: Uint8Array;
  readonly video = new Uint8Array(VIDEO_SIZE);
  private readonly ramMask: number;

  constructor(rom: Uint8Array, ramKb: 16 | 32 | 64) {
    if (rom.length !== ROM_SIZE)
      throw new Error(
        `TRS-80 ROM must be ${ROM_SIZE} bytes, got ${rom.length}`,
      );
    this.rom = rom;
    this.ram = new Uint8Array(ramKb * 1024);
    this.ramMask = ramKb * 1024 - 1;
  }

  read = (address: number): number => {
    const addr = address & 0xffff;
    if (addr < ROM_SIZE) return this.rom[addr]!;
    if (addr < VIDEO_BASE) return 0xff; // I/O + keyboard page (open bus here)
    if (addr < RAM_BASE) return this.video[addr - VIDEO_BASE]!;
    return this.ram[(addr - RAM_BASE) & this.ramMask]!;
  };

  write = (address: number, value: number): void => {
    const addr = address & 0xffff;
    if (addr < VIDEO_BASE) return; // ROM + I/O + keyboard page: ignore
    if (addr < RAM_BASE) {
      this.video[addr - VIDEO_BASE] = value & 0xff;
      return;
    }
    this.ram[(addr - RAM_BASE) & this.ramMask] = value & 0xff;
  };

  readWord(addr: number): number {
    return this.read(addr) | (this.read(addr + 1) << 8);
  }

  writeWord(addr: number, value: number): void {
    this.write(addr, value & 0xff);
    this.write(addr + 1, (value >> 8) & 0xff);
  }
}
