import {
  MemoryActivityBuffer,
  READ_BIT,
  WRITE_BIT,
} from '../../../emulator/memoryActivityBuffer';

/**
 * The SAM's paged bus.
 *
 * The Z80 sees four 16K sections; what sits in each is decided by two page
 * registers and two bits beside them:
 *
 *   A  0x0000-0x3FFF  ROM0, or RAM page LMPR&0x1F when LMPR bit 5 is set
 *   B  0x4000-0x7FFF  RAM page (LMPR + 1) & 0x1F, always
 *   C  0x8000-0xBFFF  RAM page HMPR & 0x1F
 *   D  0xC000-0xFFFF  ROM1 when LMPR bit 6 is set, else RAM page (HMPR+1)&0x1F
 *
 * So the 32K ROM is two 16K halves at opposite ends of the address space, and
 * either can be paged *out* from under the code running in it - which the ROM
 * does constantly. `GETCHAR` at 0x0018 switches ROM1 off around a single byte
 * read, and the RST 0x38 handler pages both ROMs in before dispatching. LMPR
 * bit 7 write-protects section A on real hardware.
 *
 * Sections B, C and D are addressed off the low five bits of a register, so the
 * page numbers wrap at 32 whatever RAM is fitted. A standard Coupé fits 16
 * pages; the sixteen above them are addressable but not there, and read 0xFF
 * with writes discarded. That is not a detail: it is how the ROM sizes the
 * machine. `MNINIT` walks pages 0-31 writing 0xFF and then 0x00 to each and
 * stops at the first that will not hold a zero, and reports 256K or 512K from
 * where it stopped (see `misc31.asm`). Make an unfitted page writable and the
 * machine boots claiming 512K it does not have.
 *
 * Contention is not modelled. The ASIC takes cycles off the CPU while it
 * fetches the picture, in a pattern that depends on the screen mode; nothing
 * the IDE runs depends on cycle-exact screen timing, and the cost would be paid
 * on every bus access.
 */

/** Size of the ROM image the machine runs: ROM0 and ROM1, back to back. */
export const ROM_BYTES = 32768;

/** One RAM page as the page registers address it. */
export const PAGE_BYTES = 16384;

/** Page slots the five-bit page fields can name, fitted or not. */
export const PAGE_SLOTS = 32;

/** The page field of LMPR, HMPR and VMPR alike. */
export const PAGE_MASK = PAGE_SLOTS - 1;

/** RAM fitted to a standard machine: sixteen pages. */
export const RAM_BYTES = 256 * 1024;

/** LMPR bit 5: RAM in section A instead of ROM0. */
export const LMPR_ROM0_OFF = 0x20;
/** LMPR bit 6: ROM1 in section D instead of RAM. */
export const LMPR_ROM1 = 0x40;
/** LMPR bit 7: section A is write-protected. */
export const LMPR_WPROT = 0x80;

/** What an unfitted page reads as, and what an unclaimed port returns. */
const FLOATING_BYTE = 0xff;

export class SamMemory {
  readonly rom: Uint8Array;
  /** Fitted RAM, one flat array indexed page * PAGE_BYTES + offset. */
  readonly ram: Uint8Array;
  /** Live memory-activity recorder for the memory-map overlay; off by default. */
  readonly activity = new MemoryActivityBuffer(0x10000);

  /** Low Memory Page Register (port 0xFA). */
  lmpr = 0;
  /** High Memory Page Register (port 0xFB). */
  hmpr = 0;

  private readonly pages: number;

  constructor(rom: Uint8Array, ramBytes: number = RAM_BYTES) {
    // Empty is the documented "no firmware to run" state, the same carve-out
    // the CPC memory makes: images with no redistribution grant are meant to be
    // removable (public/roms/ATTRIBUTION.md), and a machine given none has to
    // construct so that the layer above can say so rather than dying inside a
    // constructor. Any other wrong length is still refused - that is a caller
    // handing over the wrong file, and a partly-filled ROM boots to a dead
    // machine with nothing to explain it.
    if (rom.length !== 0 && rom.length !== ROM_BYTES)
      throw new Error(
        `SAM Coupé ROM must be ${ROM_BYTES} bytes, got ${rom.length}`,
      );
    this.rom = rom.length === ROM_BYTES ? rom : new Uint8Array(ROM_BYTES);
    this.ram = new Uint8Array(ramBytes);
    this.pages = ramBytes / PAGE_BYTES;
  }

  /**
   * The RAM page in section `s` (0-3), or -1 where the section holds ROM.
   * The video hardware and the host's own introspection both page by hand, so
   * this is the one place the register decode lives.
   */
  sectionPage(s: number): number {
    switch (s) {
      case 0:
        return this.lmpr & LMPR_ROM0_OFF ? this.lmpr & PAGE_MASK : -1;
      case 1:
        return (this.lmpr + 1) & PAGE_MASK;
      case 2:
        return this.hmpr & PAGE_MASK;
      default:
        return this.lmpr & LMPR_ROM1 ? -1 : (this.hmpr + 1) & PAGE_MASK;
    }
  }

  read = (address: number): number => {
    const addr = address & 0xffff;
    if (this.activity.enabled) this.stamp(addr, READ_BIT);
    return this.peek(addr);
  };

  /**
   * Record one access at the address the memory map draws it at, which is not
   * the address the CPU used.
   *
   * The map is the space SAM BASIC's own PEEK and POKE address (see
   * `../memoryMap.ts`): ROM 0, then BASIC's pages one after another from
   * 0x4000. The CPU's window is four slots that show any page anywhere, so a
   * byte of BASIC's own page has one address on the map and two in the window,
   * and the top of the window is ROM 1 for most of a running program. Stamping
   * the raw CPU address would paint ROM 1's every instruction fetch onto the
   * band the map draws as the program's third page.
   *
   * A page the map does not reach - the screen a program has just paged in,
   * anything above BASIC's four - is not recorded rather than folded onto a
   * band it is not in. ROM 1 goes the same way; the map draws only ROM 0.
   */
  private stamp(addr: number, bit: number): void {
    const section = addr >> 14;
    const page = this.sectionPage(section);
    if (page < 0) {
      // ROM: the low half is drawn where the CPU sees it, the high half not.
      if (section === 0) this.activity.hits[addr] |= bit;
      return;
    }
    const mapped = PAGE_BYTES + page * PAGE_BYTES + (addr & 0x3fff);
    if (mapped < 0x10000) this.activity.hits[mapped] |= bit;
  }

  /**
   * Read without recording the access. Everything the host reads for itself -
   * the executing BASIC line, the profiler, the screen-text reader - comes
   * through here, so the overlay never paints the IDE's own polling as the
   * program's.
   */
  peek = (address: number): number => {
    const addr = address & 0xffff;
    const section = addr >> 14;
    const page = this.sectionPage(section);
    // ROM only ever reaches section A (ROM0, the image's first half) or
    // section D (ROM1, its second).
    if (page < 0)
      return this.rom[(section === 0 ? 0 : PAGE_BYTES) + (addr & 0x3fff)]!;
    return this.pageByte(page, addr & 0x3fff);
  };

  write = (address: number, value: number): void => {
    const addr = address & 0xffff;
    if (this.activity.enabled) this.stamp(addr, WRITE_BIT);
    const section = addr >> 14;
    if (section === 0 && this.lmpr & LMPR_WPROT) return;
    const page = this.sectionPage(section);
    if (page < 0 || page >= this.pages) return; // ROM, or a page not fitted
    this.ram[page * PAGE_BYTES + (addr & 0x3fff)] = value & 0xff;
  };

  /** A byte of a physical RAM page, whether or not it is paged in anywhere. */
  pageByte(page: number, offset: number): number {
    if (page >= this.pages) return FLOATING_BYTE;
    return this.ram[page * PAGE_BYTES + offset]!;
  }

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

  /**
   * Power-on RAM contents: 0x00 for the low half of every 256 bytes and 0xFF
   * for the high half. Real DRAM comes up in some such pattern rather than
   * uniformly zeroed, and the ROM's RAM test only proves the pages it keeps -
   * a machine reset to all-zero RAM hides a program reading memory it never
   * initialised.
   */
  clearRam(): void {
    for (let i = 0; i < this.ram.length; i += 0x100) {
      this.ram.fill(0x00, i, i + 0x80);
      this.ram.fill(0xff, i + 0x80, i + 0x100);
    }
    this.lmpr = 0;
    this.hmpr = 0;
  }
}
