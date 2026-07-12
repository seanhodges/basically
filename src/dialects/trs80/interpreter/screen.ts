import { COLS, ROWS } from '../emulator/display';
import { runtimeCharToCode } from '../charset';

const PRINT_ZONE = 16; // PRINT comma advances to the next 16-column zone

/**
 * The 64×16 text screen as the interpreter sees it: a 1K buffer matching the
 * hardware video RAM at 0x3C00, so the existing {@link renderDisplay} draws it
 * unchanged. Characters are stored as TRS-80 codes (ASCII 0x20–0x7F, block
 * graphics 0x80–0xFF). Graphics use the same 2×3 sextant bit layout as
 * {@link trs80Charset} / display.ts: a 128×48 grid where cell (x>>1, y/3) holds
 * sub-cell bit `(x&1) | ((y%3)<<1)` in a 0x80-based byte.
 */
export class Screen {
  readonly video = new Uint8Array(COLS * ROWS);
  private row = 0;
  private col = 0;

  constructor() {
    this.cls();
  }

  cls(): void {
    this.video.fill(0x20);
    this.row = 0;
    this.col = 0;
  }

  get column(): number {
    return this.col;
  }

  /**
   * Emit one TRS-80 code through the display driver: the control codes act on
   * the cursor/screen (matching the ROM's video driver) rather than being
   * stored, the 0xC0–0xFF space-compression codes print `code−0xC0` spaces, and
   * everything else is written to video RAM at the cursor.
   */
  private putCode(code: number): void {
    const c = code & 0xff;
    switch (c) {
      case 0x08: // backspace and erase
        this.backspace();
        return;
      case 0x0d: // carriage return / newline
        this.newline();
        return;
      case 0x0e: // cursor on  - no visible cursor is modelled here
      case 0x0f: // cursor off
        return;
      case 0x17: // switch to 32-character (double-width) mode - not modelled
        return;
      case 0x18: // backspace, no erase
        if (this.col > 0) this.col--;
        return;
      case 0x1c: // home the cursor (top-left)
        this.row = 0;
        this.col = 0;
        return;
      case 0x1d: // move to the start of the current line
        this.col = 0;
        return;
      case 0x1e: // erase to end of line
        this.video.fill(
          0x20,
          this.row * COLS + this.col,
          (this.row + 1) * COLS,
        );
        return;
      case 0x1f: // erase to end of frame
        this.video.fill(0x20, this.row * COLS + this.col);
        return;
    }
    if (c >= 0xc0) {
      // Space compression: print (c - 0xC0) spaces (0..63).
      for (let n = c - 0xc0; n > 0; n--) this.storeCode(0x20);
      return;
    }
    this.storeCode(c);
  }

  /** Write one code to video RAM at the cursor, wrapping at the right margin. */
  private storeCode(code: number): void {
    if (this.col >= COLS) this.newline();
    this.video[this.row * COLS + this.col] = code & 0xff;
    this.col++;
  }

  /** Print a string of already-encoded TRS-80 codes. */
  printCodes(codes: ArrayLike<number>): void {
    for (let i = 0; i < codes.length; i++) this.putCode(codes[i]!);
  }

  /** Print editor / string text, encoding each character (unmappable -> '?'). */
  printText(text: string): void {
    for (const ch of text) {
      this.putCode(runtimeCharToCode(ch) ?? 0x3f);
    }
  }

  /** Erase the character left of the cursor (INPUT/edit backspace). */
  backspace(): void {
    if (this.col > 0) {
      this.col--;
      this.video[this.row * COLS + this.col] = 0x20;
    }
  }

  newline(): void {
    this.col = 0;
    this.row++;
    if (this.row >= ROWS) {
      this.scroll();
      this.row = ROWS - 1;
    }
  }

  private scroll(): void {
    this.video.copyWithin(0, COLS, COLS * ROWS);
    this.video.fill(0x20, COLS * (ROWS - 1));
  }

  /** PRINT comma: move to the next print zone, wrapping with a newline. */
  nextZone(): void {
    const target = (Math.floor(this.col / PRINT_ZONE) + 1) * PRINT_ZONE;
    if (target >= COLS) {
      this.newline();
    } else {
      while (this.col < target) this.putCode(0x20);
    }
  }

  /** PRINT TAB(n): pad with spaces to column n (0-based); never moves left. */
  tab(n: number): void {
    const target = Math.max(0, Math.floor(n));
    if (target < this.col) this.newline();
    while (this.col < target && this.col < COLS) this.putCode(0x20);
  }

  // --- block graphics (SET / RESET / POINT) ------------------------------

  private cellIndex(x: number, y: number): { idx: number; bit: number } | null {
    if (x < 0 || x >= COLS * 2 || y < 0 || y >= ROWS * 3) return null;
    const idx = Math.floor(y / 3) * COLS + (x >> 1);
    const bit = (x & 1) | ((y % 3) << 1);
    return { idx, bit };
  }

  set(x: number, y: number): void {
    const c = this.cellIndex(x, y);
    if (!c) return;
    const cur = this.video[c.idx]! >= 0x80 ? this.video[c.idx]! : 0x80;
    this.video[c.idx] = cur | (1 << c.bit);
  }

  reset(x: number, y: number): void {
    const c = this.cellIndex(x, y);
    if (!c) return;
    const cur = this.video[c.idx]! >= 0x80 ? this.video[c.idx]! : 0x80;
    this.video[c.idx] = (cur & ~(1 << c.bit)) | 0x80;
  }

  point(x: number, y: number): boolean {
    const c = this.cellIndex(x, y);
    if (!c) return false;
    const v = this.video[c.idx]!;
    return v >= 0x80 && (v & (1 << c.bit)) !== 0;
  }
}
