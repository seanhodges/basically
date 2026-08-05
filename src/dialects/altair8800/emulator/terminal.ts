// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Altair's "display" - which is not a display at all.
 *
 * Every other machine in this project renders video RAM: the CPU pokes bytes
 * into a screen buffer and a renderer draws them. The Altair has no video
 * hardware whatsoever. BASIC writes characters to a serial port, and a terminal
 * on the other end of the wire scrolls them up a screen (or hammers them onto
 * paper, on the ASR-33 the machine actually shipped alongside).
 *
 * So this module models the *terminal*, not the machine: an 80x24 grid of
 * characters with a cursor, fed one byte at a time by {@link Altair8800Serial}
 * from OUTs to the 2SIO data port, handling the handful of control codes a
 * teletype honours - CR, LF, backspace, bell - and scrolling when the cursor
 * runs off the bottom. `renderTo` then draws that grid, exactly as the TRS-80's
 * `display.ts` draws its 1K of video RAM.
 *
 * 80x24 is the glass-terminal configuration, chosen over the ASR-33's 72-column
 * paper roll because a fixed canvas suits a screen better than a scroll. Leave
 * BASIC's own TERMINAL WIDTH at its 72-column default so `PRINT`'s comma zones
 * land where the manual says they do.
 *
 * The control codes honoured are a teletype's, not a glass terminal's, because
 * that is what 8K BASIC emits: CR and LF as a pair, a bell when the line buffer
 * fills, and runs of NUL as the delay padding that gave a real carriage time to
 * return. Anything else in 0x00-0x1F is swallowed rather than guessed at - a
 * printing terminal had no cursor addressing and no clear-screen for BASIC to
 * drive, so there is no escape sequence to model.
 */

/** Terminal grid: 80 columns by 24 rows. */
export const COLS = 80;
export const ROWS = 24;

/** Character cell in pixels; 8x16 gives the 640x384 canvas the dialect declares. */
export const CELL_WIDTH = 8;
export const CELL_HEIGHT = 16;

export const DISPLAY_WIDTH = COLS * CELL_WIDTH;
export const DISPLAY_HEIGHT = ROWS * CELL_HEIGHT;

/** Control codes the terminal acts on; everything else in C0 is discarded. */
const BEL = 0x07;
const BS = 0x08;
const LF = 0x0a;
const CR = 0x0d;

const BLANK = 0x20;

const BACKGROUND = '#000000';
/** The green phosphor of the glass terminals that displaced the ASR-33. */
const FOREGROUND = '#4ce04c';

/**
 * The 80x24 character grid, as the terminal sees it: `write` consumes one byte
 * from the serial port, the buffer scrolls on overflow, and `renderTo` paints
 * it.
 */
export class Altair8800Terminal {
  /** One byte per cell, ASCII, row-major. */
  readonly cells = new Uint8Array(COLS * ROWS);

  private col = 0;
  private row = 0;

  /**
   * How many times the machine has rung the bell. Nothing audible happens - the
   * ASR-33's bell was a physical gong and this machine has no audio path - but
   * it lets a test see that BEL was honoured as a control code rather than
   * printed as a glyph.
   */
  private bellCount = 0;

  constructor() {
    this.clear();
  }

  /** Clear the screen and home the cursor. */
  clear(): void {
    this.cells.fill(BLANK);
    this.col = 0;
    this.row = 0;
    this.bellCount = 0;
  }

  /** Cursor column, 0-based. */
  get cursorCol(): number {
    return this.col;
  }

  /** Cursor row, 0-based. */
  get cursorRow(): number {
    return this.row;
  }

  /** Times BEL (0x07) has been received since the last {@link clear}. */
  get bells(): number {
    return this.bellCount;
  }

  /**
   * Consume one output byte from the serial port.
   *
   * Bit 7 is dropped: the console is a 7-bit ASCII line and 8K BASIC's own
   * output routine masks with `ANI 7F` before the byte reaches the 2SIO, so a
   * set high bit can only be a parity bit off the wire, never a character.
   */
  write(byte: number): void {
    const code = byte & 0x7f;
    if (code >= 0x20 && code < 0x7f) {
      this.put(code);
      return;
    }
    switch (code) {
      case CR:
        this.col = 0;
        return;
      case LF:
        this.lineFeed();
        return;
      case BS:
        // A teletype's backspace only moved the carriage: it never rubbed out
        // the character and never climbed back to the previous line.
        if (this.col > 0) this.col--;
        return;
      case BEL:
        this.bellCount++;
        return;
      default:
        // NUL padding, RUBOUT (0x7F, which punched all holes and printed
        // nothing) and the rest of C0: no printing terminal did anything
        // visible with them, so neither does this one.
        return;
    }
  }

  /** Read one row back as text, trailing blanks trimmed (for tests). */
  readRow(row: number): string {
    if (row < 0 || row >= ROWS) return '';
    let text = '';
    for (let col = 0; col < COLS; col++) {
      text += String.fromCharCode(this.cells[row * COLS + col] ?? BLANK);
    }
    return text.trimEnd();
  }

  /** The whole grid as newline-separated rows (for tests and diagnostics). */
  text(): string {
    const rows: string[] = [];
    for (let row = 0; row < ROWS; row++) rows.push(this.readRow(row));
    return rows.join('\n');
  }

  /**
   * True when `needle` appears on any single row. Line-oriented rather than
   * grid-wide because everything the Altair prints is a line of text, so a
   * match straddling the right margin would be an accident.
   */
  contains(needle: string): boolean {
    for (let row = 0; row < ROWS; row++) {
      if (this.readRow(row).includes(needle)) return true;
    }
    return false;
  }

  /** Paint the grid onto the emulator canvas. */
  renderTo(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);

    ctx.fillStyle = FOREGROUND;
    ctx.textBaseline = 'top';
    ctx.font = `${CELL_HEIGHT}px monospace`;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const code = this.cells[row * COLS + col] ?? BLANK;
        if (code <= BLANK) continue; // blanks and anything unprintable
        ctx.fillText(
          String.fromCharCode(code),
          col * CELL_WIDTH,
          row * CELL_HEIGHT,
        );
      }
    }

    // The terminal owns its cursor - unlike every other machine here, where the
    // ROM draws one into video RAM - so without this the screen looks dead
    // while BASIC waits at the OK prompt. An underline rather than a block: no
    // frame counter reaches this far so it cannot blink, and a static block
    // would hide the character beneath it.
    ctx.fillRect(
      this.col * CELL_WIDTH,
      this.row * CELL_HEIGHT + CELL_HEIGHT - 2,
      CELL_WIDTH,
      2,
    );
  }

  private put(code: number): void {
    if (this.col >= COLS) {
      this.col = 0;
      this.lineFeed();
    }
    this.cells[this.row * COLS + this.col] = code;
    this.col++;
  }

  private lineFeed(): void {
    // A line feed advanced the paper without moving the carriage, so the column
    // is deliberately left where it was: BASIC always sends CR first.
    if (this.row + 1 < ROWS) {
      this.row++;
      return;
    }
    this.scroll();
  }

  private scroll(): void {
    this.cells.copyWithin(0, COLS);
    this.cells.fill(BLANK, COLS * (ROWS - 1));
  }
}
