/**
 * The Amstrad CPC Gate Array (40007/40010): the chip that owns the palette, the
 * screen mode, the ROM paging bits and the raster interrupt. The CPU programs
 * it through OUTs to port &7Fxx (A15 low, A14 high); the top two bits of the
 * written byte select which of its four functions the write drives:
 *
 *   %00xxxxxx  pen select   - bits 0-3 pick pen 0-15, bit 4 picks the border
 *   %01xxxxxx  colour select - bits 0-4 set the currently-selected pen's colour
 *   %10xxxxxx  mode / ROM    - bits 0-1 screen mode, bit 2 upper-ROM disable,
 *                             bit 3 lower-ROM disable, bit 4 interrupt reset
 *   %11xxxxxx  RAM config    - bits 0-2 the 6128 bank configuration (464: inert)
 *
 * Colours are stored as the 5-bit *hardware* colour number the register holds;
 * {@link penRgb} maps that to RGB. The raster interrupt is a 6-bit counter
 * clocked once per CRTC HSYNC that fires (and self-resets) every 52 lines -
 * six times per 312-line frame, the 300Hz the firmware ticker, key scan and
 * BASIC's AFTER/EVERY timers all run off.
 */

/**
 * The 27 Locomotive/firmware INK colours in RGB. Each channel is one of three
 * levels - 0, 128, 255 - so the CPC's palette is the full 3×3×3 = 27 cube.
 * Indexed by firmware ink number (0-26), the numbers BASIC's `INK`/`BORDER`
 * and the manuals use.
 */
export const FIRMWARE_INK_RGB: ReadonlyArray<
  readonly [number, number, number]
> = [
  [0, 0, 0], // 0  Black
  [0, 0, 128], // 1  Blue
  [0, 0, 255], // 2  Bright Blue
  [128, 0, 0], // 3  Red
  [128, 0, 128], // 4  Magenta
  [128, 0, 255], // 5  Mauve
  [255, 0, 0], // 6  Bright Red
  [255, 0, 128], // 7  Purple
  [255, 0, 255], // 8  Bright Magenta
  [0, 128, 0], // 9  Green
  [0, 128, 128], // 10 Cyan
  [0, 128, 255], // 11 Sky Blue
  [128, 128, 0], // 12 Yellow
  [128, 128, 128], // 13 White
  [128, 128, 255], // 14 Pastel Blue
  [255, 128, 0], // 15 Orange
  [255, 128, 128], // 16 Pink
  [255, 128, 255], // 17 Pastel Magenta
  [0, 255, 0], // 18 Bright Green
  [0, 255, 128], // 19 Sea Green
  [0, 255, 255], // 20 Bright Cyan
  [128, 255, 0], // 21 Lime
  [128, 255, 128], // 22 Pastel Green
  [128, 255, 255], // 23 Pastel Cyan
  [255, 255, 0], // 24 Bright Yellow
  [255, 255, 128], // 25 Pastel Yellow
  [255, 255, 255], // 26 Bright White
];

/**
 * Hardware colour number (the 5-bit value the Gate Array palette register
 * actually holds, 0-31) → firmware ink number. Only 27 of the 32 values are
 * distinct; five hardware numbers duplicate earlier colours. This is the
 * standard Gate Array table (CPCWiki "Video modes and Colours" / grimware).
 */
export const HW_TO_FIRMWARE_INK: readonly number[] = [
  13,
  13,
  19,
  25,
  1,
  7,
  10,
  16, // 0x00-0x07
  7,
  25,
  24,
  26,
  6,
  8,
  15,
  17, //  0x08-0x0F
  1,
  19,
  18,
  20,
  0,
  2,
  9,
  11, //   0x10-0x17
  4,
  22,
  21,
  23,
  3,
  5,
  12,
  14, //  0x18-0x1F
];

/** Screen modes: 0 = 160×200×16, 1 = 320×200×4, 2 = 640×200×2. */
export type ScreenMode = 0 | 1 | 2;

/**
 * The raster line count at which the interrupt counter fires, and the count at
 * or above which the VSYNC re-sync also raises an interrupt. Both are the real
 * Gate Array constants.
 */
const IRQ_LINE_PERIOD = 52;
const VSYNC_IRQ_THRESHOLD = 32;
/** The Gate Array holds VSYNC two lines before it resets the interrupt counter. */
const VSYNC_IRQ_DELAY = 2;

export class GateArray {
  /** 16 pen colours + 1 border colour (index 16), each a hardware colour 0-31. */
  private readonly palette = new Uint8Array(17);
  /** Which pen the next colour-select write targets (16 = border). */
  private selectedPen = 0;
  /** Current screen mode; the CPU may change it mid-frame (split screens). */
  mode: ScreenMode = 1;
  /** ROM overlay enables, mirrored into CpcMemory by the machine. */
  lowerRomEnabled = true;
  upperRomEnabled = true;

  /** 6-bit raster interrupt counter (clocked per HSYNC). */
  private rasterCounter = 0;
  /** Set when the counter reaches its period; the machine pulses the CPU INT. */
  private irqRequested = false;
  /** Countdown after a VSYNC to the counter's forced reset (0 = not pending). */
  private vsyncDelay = 0;
  private lastVsync = false;

  /** A 464 boot leaves Mode 1, the classic blue screen and both ROMs paged in. */
  reset(): void {
    // Firmware power-on palette: pen0 blue, pen1 bright yellow, pen2 bright
    // cyan, pen3 bright red, border blue (the CPC's iconic opening screen).
    this.palette.fill(0);
    this.setPenFirmwareInk(0, 1);
    this.setPenFirmwareInk(1, 24);
    this.setPenFirmwareInk(2, 20);
    this.setPenFirmwareInk(3, 6);
    this.setPenFirmwareInk(16, 1); // border
    this.selectedPen = 0;
    this.mode = 1;
    this.lowerRomEnabled = true;
    this.upperRomEnabled = true;
    this.rasterCounter = 0;
    this.irqRequested = false;
    this.vsyncDelay = 0;
    this.lastVsync = false;
  }

  /** Seed a pen with a firmware ink number (used for the reset palette). */
  private setPenFirmwareInk(pen: number, ink: number): void {
    const hw = HW_TO_FIRMWARE_INK.indexOf(ink);
    this.palette[pen] = hw < 0 ? 0 : hw;
  }

  /** Process one OUT to the Gate Array (port &7Fxx). */
  writePort(value: number): void {
    switch (value & 0xc0) {
      case 0x00: // pen select
        this.selectedPen = value & 0x10 ? 16 : value & 0x0f;
        break;
      case 0x40: // colour select for the selected pen
        this.palette[this.selectedPen] = value & 0x1f;
        break;
      case 0x80: // mode + ROM enables + interrupt reset
        this.mode = (value & 0x03) as ScreenMode;
        this.lowerRomEnabled = (value & 0x04) === 0; // bit 2: lower-ROM disable
        this.upperRomEnabled = (value & 0x08) === 0; // bit 3: upper-ROM disable
        // Bit 4 resets the interrupt counter and drops any pending interrupt,
        // the "interrupt delay" the firmware uses to align its own timing.
        if (value & 0x10) {
          this.rasterCounter = 0;
          this.irqRequested = false;
        }
        break;
      case 0xc0: // RAM configuration (6128); the machine forwards this to memory
        break;
    }
  }

  /** The RGB triple for a pen (0-15) or the border (16). */
  penRgb(pen: number): readonly [number, number, number] {
    const hw = this.palette[pen & 0x1f] ?? 0;
    const ink = HW_TO_FIRMWARE_INK[hw & 0x1f] ?? 0;
    return FIRMWARE_INK_RGB[ink] ?? FIRMWARE_INK_RGB[0]!;
  }

  /** The border colour's RGB (pen 16). */
  borderRgb(): readonly [number, number, number] {
    return this.penRgb(16);
  }

  /**
   * Clock the interrupt counter one CRTC scanline forward. `vsync` is the CRTC's
   * current VSYNC state so the Gate Array can perform its two-line-delayed
   * counter reset (which keeps the 300Hz interrupt phase-locked to the 50Hz
   * frame). Returns true on the line the interrupt is raised.
   */
  onHsync(vsync: boolean): boolean {
    let raised = false;
    this.rasterCounter = (this.rasterCounter + 1) & 0x3f;
    if (this.rasterCounter === IRQ_LINE_PERIOD) {
      this.rasterCounter = 0;
      this.irqRequested = true;
      raised = true;
    }
    // VSYNC rising edge arms the two-line delay; when it elapses the counter
    // resets. The extra interrupt is generated only if the counter had NOT yet
    // passed the half-way mark (bit 5 clear, count < 32); if it had (bit 5 set)
    // the pending "top half" interrupt is close enough and none is added. Either
    // way the reset re-locks the interrupt phase to frame flyback.
    if (vsync && !this.lastVsync) this.vsyncDelay = VSYNC_IRQ_DELAY;
    else if (this.vsyncDelay > 0 && --this.vsyncDelay === 0) {
      if (this.rasterCounter < VSYNC_IRQ_THRESHOLD) {
        this.irqRequested = true;
        raised = true;
      }
      this.rasterCounter = 0;
    }
    this.lastVsync = vsync;
    return raised;
  }

  /** True while an interrupt is pending acknowledgement by the CPU. */
  get interruptPending(): boolean {
    return this.irqRequested;
  }

  /**
   * The CPU has taken the interrupt: drop the request and clear bit 5 of the
   * counter, as the real Gate Array does on INT acknowledge (so a routine that
   * polls the counter can tell a "top half" interrupt from a "bottom half" one).
   */
  acknowledgeInterrupt(): void {
    this.irqRequested = false;
    this.rasterCounter &= 0x1f;
  }

  /** Test/debug access to a pen's stored hardware colour number. */
  hardwareColour(pen: number): number {
    return this.palette[pen & 0x1f] ?? 0;
  }
}
