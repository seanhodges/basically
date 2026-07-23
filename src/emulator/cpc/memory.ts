import { MemoryActivityBuffer } from '../memoryActivityBuffer';

/**
 * The Amstrad CPC memory: 64K of RAM with two 16K ROMs the Gate Array can
 * overlay on top for CPU reads. Unlike the Sinclair machines the ROM is never
 * "in the way" of RAM - it is a read overlay only:
 *
 *   &0000–&3FFF  lower ROM (the firmware / OS), overlaid when enabled
 *   &4000–&BFFF  always RAM
 *   &C000–&FFFF  upper ROM (Locomotive BASIC on the 464), overlaid when enabled
 *
 * The Gate Array's ROM-enable bits (mode/ROM register, port &7Fxx) turn each
 * overlay on or off independently; the firmware pages the upper ROM out to read
 * or write the screen (which lives at &C000–&FFFF in RAM) and back in to call
 * BASIC. Writes ALWAYS land in the underlying RAM, ROM enabled or not - so the
 * screen stays writable while BASIC ROM is paged in for reads.
 *
 * The 464 has a single lower and a single upper ROM and a flat 64K of RAM. The
 * {@link setRamConfig} seam is where the 6128's bank-switched second 64K (its
 * &7Fxx `&C0`–`&DF` PAL configurations) will hook in; on the 464 only
 * configuration 0 exists, so it is inert.
 */

/** Combined ROM image size: 16K lower (OS) + 16K upper (BASIC). */
export const CPC_ROM_SIZE = 0x8000;
const ROM_BANK_SIZE = 0x4000;
const LOWER_ROM_LIMIT = 0x4000; // exclusive: &0000–&3FFF
const UPPER_ROM_BASE = 0xc000; // &C000–&FFFF
/** Screen RAM base at power-on (CRTC R12/R13 default). */
export const SCREEN_BASE = 0xc000;

export type CpcModel = '464' | '6128';

export class CpcMemory {
  /** The always-present base 64K of RAM; the renderer reads screen bytes here. */
  readonly ram = new Uint8Array(0x10000);
  /** 16K firmware / OS ROM, overlaid on &0000–&3FFF for reads when enabled. */
  readonly lowerRom = new Uint8Array(ROM_BANK_SIZE);
  /** 16K BASIC ROM, overlaid on &C000–&FFFF for reads when enabled. */
  readonly upperRom = new Uint8Array(ROM_BANK_SIZE);

  /** Both overlays start enabled: the CPU boots executing the firmware at &0000. */
  private lowerRomEnabled = true;
  private upperRomEnabled = true;

  /** Live memory-activity set for the map overlay; off unless the panel asks. */
  readonly activity = new MemoryActivityBuffer(0x10000);

  constructor(
    rom: Uint8Array,
    readonly model: CpcModel = '464',
  ) {
    // Accept either a combined 32K image (OS then BASIC, the layout of the
    // standard cpc464.rom) or the two halves already concatenated.
    this.lowerRom.set(rom.subarray(0, ROM_BANK_SIZE));
    this.upperRom.set(rom.subarray(ROM_BANK_SIZE, CPC_ROM_SIZE));
  }

  /** Wipe RAM (e.g. on reset); the ROM images are untouched. */
  clearRam(): void {
    this.ram.fill(0);
  }

  /** Re-enable both ROM overlays, as a hard reset leaves the Gate Array. */
  resetPaging(): void {
    this.lowerRomEnabled = true;
    this.upperRomEnabled = true;
  }

  /** Gate Array mode/ROM register: enable (bit clear) or disable each overlay. */
  setRomEnables(lower: boolean, upper: boolean): void {
    this.lowerRomEnabled = lower;
    this.upperRomEnabled = upper;
  }

  /**
   * 6128 RAM-configuration seam (&7Fxx `&C0`–`&DF`). On the 464 only config 0
   * exists (flat 64K), so any request is a no-op; the 6128 stage overrides the
   * banked window here. Present so the machine wiring needs no change later.
   */
  setRamConfig(_config: number): void {
    // 464: no second 64K bank fitted - nothing to switch.
  }

  /** CPU read: ROM overlay where enabled, otherwise RAM. */
  read = (addr: number): number => {
    const a = addr & 0xffff;
    if (this.activity.enabled) this.activity.hits[a]! |= 1;
    if (this.lowerRomEnabled && a < LOWER_ROM_LIMIT) return this.lowerRom[a]!;
    if (this.upperRomEnabled && a >= UPPER_ROM_BASE) {
      return this.upperRom[a - UPPER_ROM_BASE]!;
    }
    return this.ram[a]!;
  };

  /** CPU write: always to RAM (ROM is a read overlay only). */
  write = (addr: number, value: number): void => {
    const a = addr & 0xffff;
    if (this.activity.enabled) this.activity.hits[a]! |= 2;
    this.ram[a] = value & 0xff;
  };

  /** Side-effect-free RAM read for the renderer and introspection. */
  readScreen = (addr: number): number => this.ram[addr & 0xffff]!;

  /** 16-bit little-endian read straight from RAM (BASIC pointers). */
  readWord(addr: number): number {
    return this.ram[addr & 0xffff]! | (this.ram[(addr + 1) & 0xffff]! << 8);
  }

  /** 16-bit little-endian write straight to RAM. */
  writeWord(addr: number, value: number): void {
    this.ram[addr & 0xffff] = value & 0xff;
    this.ram[(addr + 1) & 0xffff] = (value >> 8) & 0xff;
  }
}
