/**
 * The Motorola 6845 CRTC as the CPC wires it. The CPU addresses it at &BCxx
 * (register select) / &BDxx (data); it owns the raster timing (total/displayed
 * character counts, sync positions) and the screen start address. The Gate
 * Array turns the CRTC's memory-address (MA) + raster-address (RA) outputs into
 * a CPU address, so the renderer asks the CRTC for {@link byteAddress} rather
 * than duplicating that mapping.
 *
 * Only the standard firmware register set is modelled to the accuracy the
 * renderer and the interrupt need - displayed geometry, the screen base, and
 * where VSYNC sits in the frame. Demo-grade mid-frame register tricks
 * (rupture, hardware scroll every line) are out of scope.
 */

/** CRTC register indices, for readability at the call sites. */
export const R = {
  H_TOTAL: 0,
  H_DISPLAYED: 1,
  H_SYNC_POS: 2,
  SYNC_WIDTHS: 3,
  V_TOTAL: 4,
  V_ADJUST: 5,
  V_DISPLAYED: 6,
  V_SYNC_POS: 7,
  INTERLACE: 8,
  MAX_RASTER: 9,
  CURSOR_START: 10,
  CURSOR_END: 11,
  START_ADDR_HIGH: 12,
  START_ADDR_LOW: 13,
  CURSOR_HIGH: 14,
  CURSOR_LOW: 15,
} as const;

/**
 * The register values the CPC firmware programs at boot (Mode 1, 40×25 text,
 * screen at &C000). These are the power-on defaults until a program reprograms
 * the CRTC.
 */
const FIRMWARE_DEFAULTS: readonly number[] = [
  63, // R0  horizontal total (chars - 1)
  40, // R1  horizontal displayed
  46, // R2  horizontal sync position
  0x8e, // R3  sync widths (vsync 8 lines, hsync 14 chars)
  38, // R4  vertical total (char rows - 1)
  0, // R5  vertical total adjust (extra scanlines)
  25, // R6  vertical displayed
  30, // R7  vertical sync position (char row)
  0, // R8  interlace / skew
  7, // R9  max raster address (scanlines per char row - 1)
  0, // R10 cursor start
  0, // R11 cursor end
  0x30, // R12 screen start address high (→ base &C000)
  0x00, // R13 screen start address low
  0, // R14 cursor high
  0, // R15 cursor low
];

export class Crtc {
  /** R0-R17 (only R0-R15 are writable; R16/R17 are the light-pen read-back). */
  private readonly regs = new Uint8Array(18);
  private selected = 0;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.regs.fill(0);
    this.regs.set(FIRMWARE_DEFAULTS);
    this.selected = 0;
  }

  /** &BCxx: latch the register the next data access targets. */
  selectRegister(reg: number): void {
    this.selected = reg & 0x1f;
  }

  /** &BDxx write: R0-R15 are writable; higher indices are read-only. */
  writeData(value: number): void {
    if (this.selected <= 15) this.regs[this.selected] = value & 0xff;
  }

  /** &BDxx read: only R12-R17 read back on the 6845 (others read 0). */
  readData(): number {
    const r = this.selected;
    return r >= 12 && r <= 17 ? this.regs[r]! : 0;
  }

  get(reg: number): number {
    return this.regs[reg] ?? 0;
  }

  /** Displayed width in character cells (R1). */
  get displayedChars(): number {
    return this.regs[R.H_DISPLAYED]!;
  }

  /** Displayed height in character rows (R6). */
  get displayedRows(): number {
    return this.regs[R.V_DISPLAYED]!;
  }

  /** Scanlines per character row (R9 + 1). */
  get rastersPerRow(): number {
    return (this.regs[R.MAX_RASTER]! & 0x1f) + 1;
  }

  /** 14-bit CRTC start address from R12/R13 (only the low 14 bits are used). */
  get startAddress(): number {
    return (
      ((this.regs[R.START_ADDR_HIGH]! << 8) | this.regs[R.START_ADDR_LOW]!) &
      0x3fff
    );
  }

  /** Total scanlines per frame: (R4 + 1) × (R9 + 1) + R5. Default = 312. */
  linesPerFrame(): number {
    return (
      (this.regs[R.V_TOTAL]! + 1) * this.rastersPerRow + this.regs[R.V_ADJUST]!
    );
  }

  /** Scanlines of active display: R6 rows × (R9 + 1). Default = 200. */
  displayedLines(): number {
    return this.regs[R.V_DISPLAYED]! * this.rastersPerRow;
  }

  /** The absolute scanline VSYNC begins on (R7 × rasters/row). */
  vsyncStartLine(): number {
    return this.regs[R.V_SYNC_POS]! * this.rastersPerRow;
  }

  /** VSYNC width in scanlines (R3 high nibble; 0 means the 6845's default 16). */
  vsyncWidth(): number {
    const w = (this.regs[R.SYNC_WIDTHS]! >> 4) & 0x0f;
    return w === 0 ? 16 : w;
  }

  /** True while absolute scanline `line` falls inside the VSYNC pulse. */
  inVsync(line: number): boolean {
    const start = this.vsyncStartLine();
    return line >= start && line < start + this.vsyncWidth();
  }

  /**
   * The CPU byte address of the first of the two bytes the CRTC fetches for
   * character cell (charCol) on display character row (charRow), raster line
   * (raster within the row). This is the CPC's MA/RA → address mapping:
   *
   *   A15,A14 = MA13,MA12   (which 16K the screen sits in - &C000 by default)
   *   A13-A11 = RA2-RA0     (scanline within the character row)
   *   A10-A1  = MA9-MA0     (the character position along the line)
   *   A0      = byte 0 or 1 of the CRTC cell (two CPU bytes per CRTC char)
   */
  byteAddress(charRow: number, raster: number, charCol: number): number {
    const ma =
      (this.startAddress + charRow * this.displayedChars + charCol) & 0x3fff;
    return (
      ((ma & 0x3000) << 2) | ((raster & 0x07) << 11) | ((ma & 0x03ff) << 1)
    );
  }
}
