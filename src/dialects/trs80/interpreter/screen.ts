import { COLS, ROWS } from '../emulator/display';
import { CharsetError } from '../../types';
import { trs80Charset } from '../charset';

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

  private putCode(code: number): void {
    if (this.col >= COLS) this.newline();
    this.video[this.row * COLS + this.col] = code & 0xff;
    this.col++;
  }

  /** Print a string of already-encoded TRS-80 codes. */
  printCodes(codes: ArrayLike<number>): void {
    for (let i = 0; i < codes.length; i++) this.putCode(codes[i]!);
  }

  /** Print editor text, encoding each character (unmappable -> '?'). */
  printText(text: string): void {
    for (const ch of text) {
      let code = 0x3f;
      try {
        code = trs80Charset.toMachine(ch)[0]!;
      } catch (e) {
        if (!(e instanceof CharsetError)) throw e;
      }
      this.putCode(code);
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
