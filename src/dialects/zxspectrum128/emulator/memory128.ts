/**
 * ZX Spectrum 128K memory: eight 16K RAM banks + two 16K ROM banks, paged by
 * port 0x7FFD.
 *
 * Fixed CPU map:
 *   0x0000-0x3FFF  ROM      — bank 0 (128 editor/menu) or bank 1 (48 BASIC)
 *   0x4000-0x7FFF  RAM      — bank 5 (the normal screen lives here)
 *   0x8000-0xBFFF  RAM      — bank 2
 *   0xC000-0xFFFF  RAM      — the bank selected by 0x7FFD bits 0-2
 *
 * Port 0x7FFD bits:
 *   0-2  RAM bank paged at 0xC000 (banks 0-7)
 *   3    displayed screen: bank 5 (normal) or bank 7 (shadow)
 *   4    ROM select: 0 = 128 editor ROM, 1 = 48 BASIC ROM
 *   5    paging-disable lock (latched until the next reset)
 *
 * read/write/readWord/writeWord stay compatible with ../zxspectrum/{vars,reports}
 * and emulator/display.ts so those reuse unchanged. (+2A/+3 add port 0x1FFD and a
 * 4-ROM set — out of scope for this 32K-ROM build.)
 */
const BANK_SIZE = 0x4000; // 16K
const ROM_BYTES = 0x8000; // 32K — two 16K ROM banks
/** Screen bitmap (0x1800) + attributes (0x300), measured from 0x4000. */
const SCREEN_LEN = 0x1b00;

export class Spectrum128Memory {
  /** 32K dual ROM: bank 0 = 128 editor/menu, bank 1 = 48 BASIC. */
  readonly rom: Uint8Array;
  /** Eight 16K RAM banks (0-7), each addressed from 0. */
  private readonly banks: Uint8Array[];

  // Port 0x7FFD decoded state (power-on defaults: bank 0, screen 5, 128 ROM).
  private pagedBank = 0; // bits 0-2: bank mapped at 0xC000
  private screenBank: 5 | 7 = 5; // bit 3: which bank the ULA displays
  private romBank: 0 | 1 = 0; // bit 4: 0 = 128 editor, 1 = 48 BASIC
  private locked = false; // bit 5: paging frozen until reset

  constructor(rom: Uint8Array) {
    if (rom.length !== ROM_BYTES)
      throw new Error(
        `ZX Spectrum 128K ROM must be ${ROM_BYTES} bytes, got ${rom.length}`,
      );
    this.rom = rom;
    this.banks = Array.from({ length: 8 }, () => new Uint8Array(BANK_SIZE));
  }

  read = (address: number): number => {
    const addr = address & 0xffff;
    if (addr < 0x4000) return this.rom[this.romBank * BANK_SIZE + addr]!;
    if (addr < 0x8000) return this.banks[5]![addr - 0x4000]!;
    if (addr < 0xc000) return this.banks[2]![addr - 0x8000]!;
    return this.banks[this.pagedBank]![addr - 0xc000]!;
  };

  write = (address: number, value: number): void => {
    const addr = address & 0xffff;
    const v = value & 0xff;
    if (addr < 0x4000) return; // ROM is read-only
    if (addr < 0x8000) {
      this.banks[5]![addr - 0x4000] = v;
      return;
    }
    if (addr < 0xc000) {
      this.banks[2]![addr - 0x8000] = v;
      return;
    }
    this.banks[this.pagedBank]![addr - 0xc000] = v;
  };

  readWord(addr: number): number {
    return this.read(addr) | (this.read(addr + 1) << 8);
  }

  writeWord(addr: number, value: number): void {
    this.write(addr, value & 0xff);
    this.write(addr + 1, (value >> 8) & 0xff);
  }

  /** Handle an OUT to port 0x7FFD; ignored once paging is locked. */
  writePort7ffd(value: number): void {
    if (this.locked) return;
    this.pagedBank = value & 0x07;
    this.screenBank = value & 0x08 ? 7 : 5;
    this.romBank = (value >> 4) & 0x01 ? 1 : 0;
    if (value & 0x20) this.locked = true;
  }

  /** The ROM bank currently paged at 0x0000 (0 = 128 editor, 1 = 48 BASIC). */
  get currentRomBank(): 0 | 1 {
    return this.romBank;
  }

  /** The RAM bank the ULA is currently displaying (5 = normal, 7 = shadow). */
  get displayedScreenBank(): 5 | 7 {
    return this.screenBank;
  }

  /**
   * Screen read for the renderer: the bitmap/attribute window at 0x4000 is
   * mapped onto whichever bank (5 or 7) is currently displayed, so the shadow
   * screen renders without the renderer knowing about paging. Other addresses
   * fall through to the normal CPU map.
   */
  readScreen = (address: number): number => {
    const addr = address & 0xffff;
    if (addr >= 0x4000 && addr < 0x4000 + SCREEN_LEN) {
      return this.banks[this.screenBank]![addr - 0x4000]!;
    }
    return this.read(addr);
  };

  /** Full reset: clear every RAM bank and restore the power-on paging. */
  clearRam(): void {
    for (const bank of this.banks) bank.fill(0);
    this.pagedBank = 0;
    this.screenBank = 5;
    this.romBank = 0;
    this.locked = false;
  }
}
