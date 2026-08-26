import {
  MemoryActivityBuffer,
  READ_BIT,
  WRITE_BIT,
} from '../../../emulator/memoryActivityBuffer';

/**
 * ZX Spectrum 48K memory map:
 *   0x0000-0x3FFF  16K ROM
 *   0x4000-0x57FF  display bitmap (6144 bytes)
 *   0x5800-0x5AFF  attribute map (768 bytes)
 *   0x5B00-0xFFFF  general RAM (system variables, program, stacks…)
 *
 * Reads and writes here cost nothing. The T-states the ULA takes off the CPU
 * for an address below 0x8000 are charged one level up, in the machine's own
 * bus hooks (see ulaContention.ts), because only the CPU's accesses owe them:
 * the host reads through here too - the executing BASIC line, the profiler, the
 * memory-map overlay, the tape traps - and none of that is time the emulated
 * machine spends.
 */
/** Size of the ZX Spectrum's 16K ROM image; the memory map's ROM region matches it. */
export const ROM_BYTES = 16384;

export class SpectrumMemory {
  readonly rom: Uint8Array;
  readonly ram = new Uint8Array(0xc000); // 48K, addressed from 0x4000
  /**
   * Live memory-activity recorder for the memory-map overlay. Disabled by
   * default; the host arms it only while the map is on screen. When enabled,
   * `read`/`write` stamp the touched address with a single indexed `|=`.
   */
  readonly activity = new MemoryActivityBuffer(0x10000);

  constructor(rom: Uint8Array) {
    if (rom.length !== ROM_BYTES)
      throw new Error(
        `ZX Spectrum ROM must be ${ROM_BYTES} bytes, got ${rom.length}`,
      );
    this.rom = rom;
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
    const addr = address & 0xffff;
    if (addr < 0x4000) return this.rom[addr]!;
    return this.ram[addr - 0x4000]!;
  };

  write = (address: number, value: number): void => {
    const addr = address & 0xffff;
    if (this.activity.enabled) this.activity.hits[addr] |= WRITE_BIT;
    if (addr < 0x4000) return; // ROM is read-only
    this.ram[addr - 0x4000] = value & 0xff;
  };

  readWord(addr: number): number {
    return this.read(addr) | (this.read(addr + 1) << 8);
  }

  /** {@link readWord} through {@link peek}: no activity recorded. */
  rawReadWord(addr: number): number {
    return this.peek(addr) | (this.peek(addr + 1) << 8);
  }

  writeWord(addr: number, value: number): void {
    this.write(addr, value & 0xff);
    this.write(addr + 1, (value >> 8) & 0xff);
  }

  /** Clear RAM (full machine reset). */
  clearRam(): void {
    this.ram.fill(0);
  }
}
