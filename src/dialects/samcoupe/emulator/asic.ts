/**
 * The video half of the 10,000-gate ASIC: the four screen modes, the 16-entry
 * CLUT over the 128-colour palette, the border, and the two interrupt sources
 * the status port reports.
 *
 * Registers, all on the ASIC's own ports (0xF8 and up):
 *
 *   0xF8 write  CLUT entry, selected by the low four bits of the port's HIGH
 *               byte - so `OUT (&F8),A` with B holding the index. The value is
 *               a 7-bit palette colour.
 *   0xF9 read   status: five active-LOW interrupt flags in bits 0-4, and the
 *               top three bits of the selected keyboard rows in bits 5-7.
 *   0xF9 write  the display line a line interrupt fires on, 0-191. Anything
 *               192 or over disables it.
 *   0xFC r/w    VMPR: screen page in bits 0-4, mode in bits 5-6.
 *   0xFE write  border colour (bits 0-2 and 5), the loudspeaker (bit 4), the
 *               tape output (bit 3), and screen-off (bit 7).
 *
 * The interrupt flags read active-low and are asserted for a fixed window: the
 * frame interrupt at the top of every frame, the line interrupt when the raster
 * reaches the programmed line. A handler reads the status port to find out
 * which fired, so both have to be visible at once when they coincide.
 *
 * The 128-colour palette is not a table: each entry's three-bit red, green and
 * blue come from four bits of the index, one of which - bit 3 - is a half-step
 * shared by all three. It is decoded rather than tabulated, so the numbers here
 * cannot drift from what the hardware computes.
 */

/** Colours the palette can express; sixteen of them are on screen at once. */
export const PALETTE_COLOURS = 128;

/** Entries in the colour lookup table. */
export const CLUT_ENTRIES = 16;

/** Display lines the ASIC paints, and the line the picture starts on. */
export const SCREEN_LINES = 192;
/** Border lines above the picture; the line interrupt is timed against them. */
export const TOP_BORDER_LINES = 68;

/** Status-port bits, all active low. */
export const STATUS_INT_LINE = 0x01;
export const STATUS_INT_FRAME = 0x08;
/** No interrupt outstanding: every source's bit high. */
export const STATUS_INT_NONE = 0x1f;

/**
 * Cycles the ASIC holds an interrupt line low. Long enough that a `DI` region
 * straddling the moment still sees it when interrupts come back on, which is
 * what raster code on this machine relies on.
 */
export const INT_ACTIVE_CYCLES = 128;

/** VMPR bits 5-6 select the mode; the value below is `mode - 1`. */
export const VMPR_MODE_MASK = 0x60;
export const VMPR_MODE_SHIFT = 5;
/** VMPR bit 6 alone: set for the two 24K modes (3 and 4). */
export const VMPR_MDE1 = 0x40;

/** Border-port bits. */
export const BORDER_MIC = 0x08;
export const BORDER_BEEP = 0x10;
export const BORDER_SCREEN_OFF = 0x80;

/**
 * The border colour is four bits split across the port: 0-2 are the low three
 * and bit 5 is the fourth. It indexes the CLUT like any pixel.
 */
export function borderClutIndex(border: number): number {
  return ((border & 0x20) >> 2) | (border & 0x07);
}

/**
 * One palette colour as 8-bit RGB.
 *
 * Each component is a three-bit level built from separate index bits, with
 * bit 3 contributing the least significant step to all three at once - which is
 * why the palette has bright and dim versions of the same hue rather than a
 * separate brightness control. Levels 0-7 are scaled to 0-255.
 */
export function paletteRgb(colour: number): [number, number, number] {
  const c = colour & (PALETTE_COLOURS - 1);
  const half = (c & 0x08) >> 3;
  const r = ((c & 0x20) >> 3) | ((c & 0x02) >> 0) | half;
  const g = ((c & 0x40) >> 4) | ((c & 0x04) >> 1) | half;
  const b = ((c & 0x10) >> 2) | ((c & 0x01) << 1) | half;
  return [(r * 255) / 7, (g * 255) / 7, (b * 255) / 7].map(Math.round) as [
    number,
    number,
    number,
  ];
}

export class SamAsic {
  /** Colour lookup table: sixteen palette indices. */
  readonly clut = new Uint8Array(CLUT_ENTRIES);
  /** Video Memory Page Register: screen page and mode. */
  vmpr = 0;
  /** Border port latch, as last written. */
  border = 0;
  /** Line a line interrupt is due on; 192 or over means never. */
  lineInterruptLine = 0xff;
  /** Interrupt flags, active low (a clear bit is an interrupt outstanding). */
  status = STATUS_INT_NONE;
  /** MODE 1/2 FLASH phase, toggled every sixteen frames by the machine. */
  flashPhase = false;

  reset(): void {
    this.clut.fill(0);
    this.vmpr = 0;
    this.border = 0;
    this.lineInterruptLine = 0xff;
    this.status = STATUS_INT_NONE;
    this.flashPhase = false;
  }

  /** Screen mode 1-4, from VMPR bits 5-6. */
  get mode(): number {
    return ((this.vmpr & VMPR_MODE_MASK) >> VMPR_MODE_SHIFT) + 1;
  }

  /**
   * The RAM page the picture is fetched from. Modes 3 and 4 need 24K, which
   * spans two pages, so the ASIC ignores the page field's bottom bit for them.
   */
  get screenPage(): number {
    const page = this.vmpr & 0x1f;
    return this.vmpr & VMPR_MDE1 ? page & ~1 : page;
  }

  /**
   * Whether the screen is blanked. Bit 7 of the border port blanks the display
   * to black - and only in modes 3 and 4, where turning the ASIC's fetch off is
   * what buys the CPU the contended cycles back.
   */
  get screenOff(): boolean {
    return (
      (this.border & BORDER_SCREEN_OFF) !== 0 && (this.vmpr & VMPR_MDE1) !== 0
    );
  }

  /** Write to an ASIC port; `port` is the full 16-bit address. */
  writePort(port: number, value: number): void {
    switch (port & 0xff) {
      case 0xf8:
        // The CLUT index rides on the port's high byte, not on the data.
        this.clut[(port >> 8) & (CLUT_ENTRIES - 1)] = value & 0x7f;
        break;
      case 0xf9:
        this.lineInterruptLine = value & 0xff;
        break;
      case 0xfc:
        this.vmpr = value & (VMPR_MODE_MASK | 0x1f);
        break;
      case 0xfe:
        this.border = value & 0xff;
        break;
    }
  }

  /**
   * Pull one source's status bit low from frame cycle `cycle`, for the window
   * the ASIC holds it. The two sources are held independently because they can
   * overlap: a line interrupt programmed near the top of the screen fires while
   * the frame interrupt is still asserted, and the handler tells them apart by
   * reading the status port.
   */
  raiseInterrupt(bit: number, cycle: number): void {
    this.status &= ~bit;
    if (bit === STATUS_INT_FRAME)
      this.frameIntUntil = cycle + INT_ACTIVE_CYCLES;
    else this.lineIntUntil = cycle + INT_ACTIVE_CYCLES;
  }

  /** The frame cycle a line interrupt is due at, or null when none is armed. */
  lineInterruptCycle(cyclesPerLine: number): number | null {
    if (this.lineInterruptLine >= SCREEN_LINES) return null;
    return (this.lineInterruptLine + TOP_BORDER_LINES) * cyclesPerLine;
  }

  /** Let go of any source whose hold window has expired by frame cycle `cycle`. */
  releaseExpiredInterrupts(cycle: number): void {
    if (cycle >= this.frameIntUntil) this.status |= STATUS_INT_FRAME;
    if (cycle >= this.lineIntUntil) this.status |= STATUS_INT_LINE;
  }

  /** True while any source is asserting /INT. */
  get interruptPending(): boolean {
    return (this.status & STATUS_INT_NONE) !== STATUS_INT_NONE;
  }

  /** Frame cycles the two sources stay asserted until. */
  private frameIntUntil = 0;
  private lineIntUntil = 0;
}
