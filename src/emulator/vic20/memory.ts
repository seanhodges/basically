/**
 * The unexpanded PAL VIC-20 address space, assembled as the {@link BusInterface}
 * the vendored 6502 core reads and writes through. Like the PET machine this is
 * a flat 64 KB byte array with ROM baked in on bringup; the memory-mapped chips
 * (VIC-I and the two VIAs) are decoded to injected accessors so the machine owns
 * the chip instances.
 *
 * Unexpanded memory map (5 KB RAM, BASIC V2 loads at $1001):
 *
 *   $0000–$03FF  1 KB low RAM (zero page, stack, KERNAL workspace)
 *   $0400–$0FFF  3 KB expansion block (open bus — no +3K RAM fitted)
 *   $1000–$1DFF  3.5 KB user BASIC RAM
 *   $1E00–$1FFF  512-byte screen matrix (22×23 = 506 cells + slack)
 *   $2000–$7FFF  8/16 KB expansion blocks 1–3 (open bus)
 *   $8000–$8FFF  4 KB character generator ROM (901460-03)
 *   $9000–$900F  VIC-I (6561) registers
 *   $9110–$911F  VIA #1 (NMI/RESTORE, user port, joystick up/down/left/fire)
 *   $9120–$912F  VIA #2 (system IRQ timer, keyboard matrix, joystick right)
 *   $9400–$97FF  4-bit colour RAM (the $1E00 screen pairs with $9600)
 *   $9800–$BFFF  I/O-2/3 + cartridge blocks (open bus)
 *   $C000–$DFFF  8 KB BASIC V2 ROM (901486-01)
 *   $E000–$FFFF  8 KB KERNAL ROM (PAL 901486-07)
 *
 * The expansion/cartridge holes read as open bus ($FF, never the last written
 * byte) so the KERNAL's power-on RAM-presence probes at $0400/$2000/$A000 all
 * fail and BASIC stays configured for the unexpanded 3583-byte program area.
 */

import type { BusInterface } from '../6502/cpu6502.js';

/** Screen matrix base on the unexpanded machine (7680 decimal). */
export const SCREEN_BASE = 0x1e00;
/** Colour-nibble RAM base paired with the $1E00 screen (38400 decimal). */
export const COLOR_BASE = 0x9600;

const LOWRAM_END = 0x0400; // exclusive
const MAINRAM_BASE = 0x1000;
const MAINRAM_END = 0x2000; // exclusive
const CHARGEN_BASE = 0x8000;
const CHARGEN_END = 0x9000; // exclusive
const VIC_BASE = 0x9000;
const VIA1_BASE = 0x9110;
const VIA2_BASE = 0x9120;
const COLOR_LOW = 0x9400;
const COLOR_HIGH = 0x9800; // exclusive
const BASIC_BASE = 0xc000;

const OPEN_BUS = 0xff;

/** The three VIC-20 ROM images, supplied directly (tests) or fetched (browser). */
export interface Vic20Roms {
  /** 8 KB BASIC V2 ROM mapped at $C000 (901486-01). */
  basic: Uint8Array;
  /** 8 KB KERNAL ROM mapped at $E000 (PAL 901486-07). */
  kernal: Uint8Array;
  /** 4 KB character generator mapped at $8000 (901460-03). */
  character: Uint8Array;
}

/** Memory-mapped chip accessors the bus decodes register reads/writes to. */
export interface Vic20Io {
  readVic(reg: number): number;
  writeVic(reg: number, value: number): void;
  readVia1(reg: number): number;
  writeVia1(reg: number, value: number): void;
  readVia2(reg: number): number;
  writeVia2(reg: number, value: number): void;
}

/**
 * Owns the 64 KB memory image (RAM + baked-in ROM) and turns a set of chip
 * accessors into the CPU's {@link BusInterface}. The renderer reads screen and
 * colour RAM straight out of {@link Vic20Memory.mem}.
 */
export class Vic20Memory {
  /** Full 64 KB space; RAM/screen/colour writable, ROM regions read-only. */
  readonly mem = new Uint8Array(0x10000);

  installRoms(roms: Vic20Roms): void {
    this.mem.fill(0);
    this.mem.set(roms.character.subarray(0, 0x1000), CHARGEN_BASE);
    this.mem.set(roms.basic.subarray(0, 0x2000), BASIC_BASE);
    this.mem.set(roms.kernal.subarray(0, 0x2000), 0xe000);
  }

  /** Clear RAM (low + main + colour + screen) without disturbing the ROMs. */
  clearRam(): void {
    this.mem.fill(0, 0x0000, LOWRAM_END);
    this.mem.fill(0, MAINRAM_BASE, MAINRAM_END);
    this.mem.fill(0, COLOR_LOW, COLOR_HIGH);
  }

  /** Side-effect-free byte read (RAM/ROM only; I/O reads back as open bus). */
  peek(addr: number): number {
    const a = addr & 0xffff;
    if (a < LOWRAM_END) return this.mem[a]!;
    if (a >= MAINRAM_BASE && a < MAINRAM_END) return this.mem[a]!;
    if (a >= CHARGEN_BASE && a < CHARGEN_END) return this.mem[a]!;
    if (a >= COLOR_LOW && a < COLOR_HIGH) return this.mem[a]!;
    if (a >= BASIC_BASE) return this.mem[a]!;
    return OPEN_BUS;
  }

  makeBus(io: Vic20Io): BusInterface {
    const read = (addr: number): number => {
      const a = addr & 0xffff;
      // Memory-mapped I/O lives in the $9000–$93FF page block.
      if (a >= VIC_BASE && a < COLOR_LOW) {
        if (a < VIC_BASE + 0x10) return io.readVic(a & 0x0f);
        if (a >= VIA1_BASE && a < VIA1_BASE + 0x10)
          return io.readVia1(a & 0x0f);
        if (a >= VIA2_BASE && a < VIA2_BASE + 0x10)
          return io.readVia2(a & 0x0f);
        return OPEN_BUS; // VIC/VIA mirrors and gaps
      }
      return this.peek(a);
    };
    const write = (addr: number, value: number): void => {
      const a = addr & 0xffff;
      const v = value & 0xff;
      if (a < LOWRAM_END || (a >= MAINRAM_BASE && a < MAINRAM_END)) {
        this.mem[a] = v; // RAM + screen matrix
      } else if (a >= COLOR_LOW && a < COLOR_HIGH) {
        this.mem[a] = v; // 4-bit colour RAM (upper nibble ignored by the VIC)
      } else if (a >= VIC_BASE && a < VIA1_BASE) {
        if (a < VIC_BASE + 0x10) io.writeVic(a & 0x0f, v);
      } else if (a >= VIA1_BASE && a < VIA1_BASE + 0x10) {
        io.writeVia1(a & 0x0f, v);
      } else if (a >= VIA2_BASE && a < VIA2_BASE + 0x10) {
        io.writeVia2(a & 0x0f, v);
      }
      // Everything else (expansion holes, cartridge, ROM) ignores writes.
    };
    return {
      read,
      write,
      peek: (a) => this.peek(a & 0xffff),
      poke: (a, v) => write(a, v),
      readWord: (a) => read(a) | (read((a + 1) & 0xffff) << 8),
    };
  }
}
