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
 * The 464 and the 664 have a single lower and a single upper ROM and a flat 64K
 * of RAM. The 6128 fits a second 64K that the PAL banks over the base one in
 * 16K windows - see {@link setRamConfig}; on the other two only configuration 0
 * exists, so it is inert.
 */

/** Combined ROM image size: 16K lower (OS) + 16K upper (BASIC). */
export const CPC_ROM_SIZE = 0x8000;
const ROM_BANK_SIZE = 0x4000;
const LOWER_ROM_LIMIT = 0x4000; // exclusive: &0000–&3FFF
const UPPER_ROM_BASE = 0xc000; // &C000–&FFFF
/**
 * Screen RAM base at power-on (CRTC R12/R13 default). Owned by the dialect,
 * which is also what the memory maps read it from - the documentation bundle
 * renders those maps and must not reach an emulator module to do it.
 */
export { SCREEN_BASE } from '../../dialects/cpc464/addresses';

export type CpcModel = '464' | '664' | '6128';

/** The four 16K CPU windows a RAM configuration maps: &0000/&4000/&8000/&C000. */
const WINDOW_SIZE = 0x4000;
const WINDOWS = 4;

/**
 * The eight standard 6128 RAM configurations, as the PAL (40010) decodes bits
 * 0-2 of a `&7Fxx` `%11xxxxxx` write. Each row is the 16K bank mapped into
 * &0000, &4000, &8000 and &C000; banks 0-3 are the base 64K and banks 4-7 the
 * expansion 64K.
 *
 * Configuration 0 is the flat base 64K the machine boots into and the only one
 * BASIC itself uses. Configuration 2 is the "all expansion" one CP/M Plus runs
 * from; the rest window a single expansion bank into &4000 (4-7) or juggle the
 * base banks around &C000 (1, 3).
 */
const RAM_CONFIGS: readonly (readonly number[])[] = [
  [0, 1, 2, 3], // 0
  [0, 1, 2, 7], // 1
  [4, 5, 6, 7], // 2
  [0, 3, 2, 7], // 3
  [0, 4, 2, 3], // 4
  [0, 5, 2, 3], // 5
  [0, 6, 2, 3], // 6
  [0, 7, 2, 3], // 7
];

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

  /**
   * The 6128's second 64K, as four 16K banks (4-7). Empty on the 464 and the
   * 664, neither of which has one fitted.
   */
  readonly expansionRam: Uint8Array;
  /** The selected RAM configuration (index into {@link RAM_CONFIGS}). */
  private ramConfig = 0;
  /**
   * Base offset of each 16K CPU window within {@link expansionRam}, or -1 when
   * that window is mapped to the base RAM at its own address. All -1 in
   * configuration 0, which is why that case can take the direct path below.
   */
  private readonly windowOffset = new Int32Array(WINDOWS).fill(-1);
  /** True while any window is mapped somewhere other than its own base RAM. */
  private banked = false;
  /** True when a base bank (0-3) is windowed at an address that is not its own. */
  private baseRemap = false;
  /** The bank each window currently holds, for the remap path. */
  private configBanks: readonly number[] = RAM_CONFIGS[0]!;

  constructor(
    rom: Uint8Array,
    readonly model: CpcModel = '464',
  ) {
    this.expansionRam = new Uint8Array(model === '6128' ? 0x10000 : 0);
    // A combined 32K image: OS then BASIC, the layout of the standard
    // cpc464.rom. Anything else is refused rather than loaded in part - the
    // `subarray` calls below would happily take a short image, fill a prefix of
    // the lower ROM and leave the rest (and all of BASIC) zeroed, which boots to
    // a dead machine with nothing to explain it. The likeliest way to get here
    // is supplying one 16K half of the pair. Empty is the exception: it is the
    // documented "no firmware to run" state (see CpcMachine's ROM note), which
    // the suites here fall back to when the un-redistributable image is absent.
    if (rom.length !== 0 && rom.length !== CPC_ROM_SIZE) {
      throw new Error(
        `Amstrad CPC ROM must be ${CPC_ROM_SIZE} bytes, got ${rom.length}`,
      );
    }
    this.lowerRom.set(rom.subarray(0, ROM_BANK_SIZE));
    this.upperRom.set(rom.subarray(ROM_BANK_SIZE, CPC_ROM_SIZE));
  }

  /** Wipe RAM (e.g. on reset); the ROM images are untouched. */
  clearRam(): void {
    this.ram.fill(0);
    this.expansionRam.fill(0);
  }

  /** Re-enable both ROM overlays, as a hard reset leaves the Gate Array. */
  resetPaging(): void {
    this.lowerRomEnabled = true;
    this.upperRomEnabled = true;
    this.setRamConfig(0);
  }

  /** Gate Array mode/ROM register: enable (bit clear) or disable each overlay. */
  setRomEnables(lower: boolean, upper: boolean): void {
    this.lowerRomEnabled = lower;
    this.upperRomEnabled = upper;
  }

  /**
   * Select a RAM configuration from a `&7Fxx` `%11xxxxxx` write (bits 0-2; the
   * upper bits are the expansion-RAM bank select on machines with more than
   * 128K, which the 6128 does not have). On the 464 and the 664 no second bank
   * is fitted, so every request is a no-op and the flat 64K stands.
   */
  setRamConfig(config: number): void {
    if (this.model !== '6128') return;
    const selected = config & 0x07;
    this.ramConfig = selected;
    const banks = RAM_CONFIGS[selected]!;
    for (let w = 0; w < WINDOWS; w++) {
      const bank = banks[w]!;
      // Banks 0-3 are the base 64K; only 4-7 come from the expansion, and only
      // then does the window need redirecting.
      this.windowOffset[w] = bank < 4 ? -1 : (bank - 4) * WINDOW_SIZE;
    }
    // Configuration 3 windows a *base* bank (3) at an address that is not its
    // own (&4000), which the -1 fast path cannot express - it assumes a base
    // bank sits where it belongs. Flag that case so reads and writes go through
    // the explicit bank index instead.
    this.baseRemap = banks.some((bank, w) => bank < 4 && bank !== w);
    this.banked = selected !== 0;
    this.configBanks = banks;
  }

  /** The currently selected RAM configuration (0-7). */
  get ramConfiguration(): number {
    return this.ramConfig;
  }

  /**
   * Resolve a CPU address to the array and offset the current configuration
   * maps it to. Only reached when a non-zero configuration is selected.
   */
  private mappedRead(a: number): number {
    const w = a >> 14;
    const off = this.windowOffset[w]!;
    if (off >= 0) return this.expansionRam[off + (a & 0x3fff)]!;
    if (!this.baseRemap) return this.ram[a]!;
    return this.ram[this.configBanks[w]! * WINDOW_SIZE + (a & 0x3fff)]!;
  }

  private mappedWrite(a: number, value: number): void {
    const w = a >> 14;
    const off = this.windowOffset[w]!;
    if (off >= 0) {
      this.expansionRam[off + (a & 0x3fff)] = value;
      return;
    }
    if (!this.baseRemap) {
      this.ram[a] = value;
      return;
    }
    this.ram[this.configBanks[w]! * WINDOW_SIZE + (a & 0x3fff)] = value;
  }

  /** CPU read: ROM overlay where enabled, otherwise RAM. */
  read = (addr: number): number => {
    const a = addr & 0xffff;
    if (this.activity.enabled) this.activity.hits[a]! |= 1;
    if (this.lowerRomEnabled && a < LOWER_ROM_LIMIT) return this.lowerRom[a]!;
    if (this.upperRomEnabled && a >= UPPER_ROM_BASE) {
      return this.upperRom[a - UPPER_ROM_BASE]!;
    }
    return this.banked ? this.mappedRead(a) : this.ram[a]!;
  };

  /** CPU write: always to RAM (ROM is a read overlay only). */
  write = (addr: number, value: number): void => {
    const a = addr & 0xffff;
    const v = value & 0xff;
    if (this.activity.enabled) this.activity.hits[a]! |= 2;
    if (this.banked) this.mappedWrite(a, v);
    else this.ram[a] = v;
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
