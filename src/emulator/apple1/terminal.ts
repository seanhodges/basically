// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { plainChar } from '../../dialects/apple1/charset';

/**
 * The Apple I's terminal section, modelled as logic rather than as an image.
 *
 * None of this hardware is CPU-addressable. The board's display half is a
 * 1K-bit shift register holding 40x24 six-bit character codes, a Signetics 2513
 * character generator turning each into a 5x7 dot pattern, and a page of
 * discrete logic sequencing the two against the video counters. The CPU's only
 * contact with it is one byte at a time through the PIA's side B, so there is
 * nothing here to load from a file: the grid, the scroll, the cursor and the
 * timing are the whole of what the terminal is, and they are written out here.
 *
 * ### One character per video field
 *
 * The shift register has to rotate once for a character to be inserted, and a
 * rotation is a video field - so the machine writes exactly 60 characters a
 * second and cannot be hurried. That is not a limit imposed here for
 * politeness; it is the reason the Apple I types the way it does, and the
 * software depends on it: the monitor's echo routine at `$FFEF` sits in
 * `BIT DSP / BMI` until PB7 goes low, and a terminal that answered "ready"
 * immediately would run that loop zero times and print a screenful in a frame.
 * {@link busy} is that line, and {@link tick} is what lowers it again.
 *
 * ### The line discipline is one control code wide
 *
 * There is no line feed, no backspace, no clear-screen and no cursor
 * addressing: the only code the display acts on is carriage return, which
 * moves to the start of the next line, and the only way to clear the screen is
 * the CLEAR SCREEN button, which is wired to the video logic and not to the
 * CPU at all. Everything the character generator cannot draw - anything outside
 * `$20`-`$5F` once bit 7 is stripped - is discarded rather than guessed at,
 * the way the Altair's terminal discards the C0 codes its teletype ignored.
 * Neither the monitor nor Integer BASIC ever sends one.
 */

/** The character grid: 40 columns by 24 rows. */
export const COLS = 40;
export const ROWS = 24;

/** The machine's own cell: a 5x7 glyph in a 7x8 cell, giving 280x192. */
export const CELL_WIDTH = 7;
export const CELL_HEIGHT = 8;

export const DISPLAY_WIDTH = COLS * CELL_WIDTH;
export const DISPLAY_HEIGHT = ROWS * CELL_HEIGHT;

/** Video fields a second, and so characters a second. */
export const FIELD_HZ = 60;

/** Carriage return - the one code the display logic decodes. */
const CR = 0x0d;

/** Lowest and highest ASCII the 2513 holds a glyph for. */
const FIRST_GLYPH = 0x20;
const LAST_GLYPH = 0x5f;

/** A blank cell, as the machine stores it: space with bit 7 set. */
const BLANK = 0xa0;

/** The cursor the video logic draws at the write position. */
const CURSOR = '@';

/**
 * Video fields the cursor spends showing, and again hiding. The hardware
 * divides the field rate down to flash it; 16 gives the ~2Hz flash the machine
 * is described as having, and is chosen to look right rather than read off the
 * schematic.
 */
const CURSOR_FLASH_FIELDS = 16;

const BACKGROUND = '#000000';
/**
 * White, because the Apple I put composite video into whatever monitor its
 * owner had rather than into a phosphor of its own.
 */
const FOREGROUND = '#e8e8e8';

export class Apple1Terminal {
  /** One byte per cell, as the machine stores characters: bit 7 set, row-major. */
  readonly cells = new Uint8Array(COLS * ROWS);

  private col = 0;
  private row = 0;
  /**
   * Cycles of the character time still owed before PB7 falls again. Public
   * because the CPU step decrements it once per clock and the whole point is
   * that pacing the display costs one compare on that path.
   */
  busyCycles = 0;
  private fields = 0;

  /**
   * @param characterCycles CPU cycles one video field is worth - the time a
   *   character takes to shift in, and so how long {@link busy} stays high.
   */
  constructor(private readonly characterCycles: number) {
    this.clear();
  }

  /** The CLEAR SCREEN button, and power-on: blank the grid and home the cursor. */
  clear(): void {
    this.cells.fill(BLANK);
    this.col = 0;
    this.row = 0;
    this.busyCycles = 0;
    this.fields = 0;
  }

  /** PB7: high while the shift register is still taking the last character. */
  get busy(): boolean {
    return this.busyCycles > 0;
  }

  get cursorCol(): number {
    return this.col;
  }

  get cursorRow(): number {
    return this.row;
  }

  /** One CPU clock of display time. */
  tick(): void {
    if (this.busyCycles > 0) this.busyCycles--;
  }

  /** One video field: the cursor's flash is counted in these. */
  endField(): void {
    this.fields++;
  }

  /** True while the cursor is in the showing half of its flash. */
  get cursorVisible(): boolean {
    return Math.floor(this.fields / CURSOR_FLASH_FIELDS) % 2 === 0;
  }

  /**
   * Take one character from the PIA's side B. Bit 7 is dropped: it is the busy
   * line coming the other way and never part of the character, which is why
   * software writes `$8D` for a carriage return and `$C1` for `A`.
   */
  write(byte: number): void {
    const code = byte & 0x7f;
    this.busyCycles = this.characterCycles;
    if (code === CR) {
      this.col = 0;
      this.lineFeed();
      return;
    }
    if (code < FIRST_GLYPH || code > LAST_GLYPH) return;
    if (this.col >= COLS) {
      this.col = 0;
      this.lineFeed();
    }
    this.cells[this.row * COLS + this.col] = code | 0x80;
    this.col++;
  }

  /** Read one row back as text, trailing blanks trimmed (for tests). */
  readRow(row: number): string {
    if (row < 0 || row >= ROWS) return '';
    return this.rowText(row).trimEnd();
  }

  /** One row as exactly {@link COLS} characters, blanks included. */
  rowText(row: number): string {
    let text = '';
    for (let col = 0; col < COLS; col++) {
      text += plainChar(this.cells[row * COLS + col] ?? BLANK) ?? ' ';
    }
    return text;
  }

  /** The whole grid as newline-separated rows (for tests and diagnostics). */
  text(): string {
    const rows: string[] = [];
    for (let row = 0; row < ROWS; row++) rows.push(this.readRow(row));
    return rows.join('\n');
  }

  /**
   * True when `needle` appears on any single row. Line-oriented rather than
   * grid-wide: everything this machine prints is a line, so a match straddling
   * the right margin would be an accident.
   */
  contains(needle: string): boolean {
    for (let row = 0; row < ROWS; row++) {
      if (this.rowText(row).includes(needle)) return true;
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
        if (code === BLANK) continue;
        const glyph = plainChar(code);
        if (glyph === undefined) continue;
        ctx.fillText(glyph, col * CELL_WIDTH, row * CELL_HEIGHT);
      }
    }

    // The video logic draws the cursor, not the software, so nothing in the
    // grid marks the write position and without this the screen looks dead
    // while the monitor waits for a key.
    if (this.cursorVisible) {
      ctx.fillText(CURSOR, this.col * CELL_WIDTH, this.row * CELL_HEIGHT);
    }
  }

  private lineFeed(): void {
    if (this.row + 1 < ROWS) {
      this.row++;
      return;
    }
    this.cells.copyWithin(0, COLS);
    this.cells.fill(BLANK, COLS * (ROWS - 1));
  }
}
