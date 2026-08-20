// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The PMD 85 key matrix: sixteen rows of five keys, plus a seventeenth row that
 * is read on every scan.
 *
 * A row is selected by writing its *number* to the motherboard 8255's port A -
 * a 4-bit binary value into a 1-of-16 decoder, not the one-hot line select the
 * Sinclair machines use - and the keys of that row come back on port B, a
 * pressed key reading 0. Bits 5-7 of port B carry SHIFT and STOP, which are
 * wired across the whole matrix rather than to a row of their own, so every
 * scan reads them whichever row it asked for; {@link MODIFIER_ROW} is where
 * this class keeps them.
 *
 * Row 0 is the leftmost column of the keyboard and bit 0 the top of it, which
 * is why K0/1/Q/A/Space share a row: the matrix follows the physical columns
 * of the keyboard, not the alphabet.
 */
const ROWS: readonly (readonly (string | null)[])[] = [
  //  bit0    bit1        bit2        bit3            bit4
  ['K0', 'Digit1', 'KeyQ', 'KeyA', 'Space'],
  ['K1', 'Digit2', 'KeyW', 'KeyS', 'KeyZ'],
  ['K2', 'Digit3', 'KeyE', 'KeyD', 'KeyX'],
  ['K3', 'Digit4', 'KeyR', 'KeyF', 'KeyC'],
  ['K4', 'Digit5', 'KeyT', 'KeyG', 'KeyV'],
  ['K5', 'Digit6', 'KeyY', 'KeyH', 'KeyB'],
  ['K6', 'Digit7', 'KeyU', 'KeyJ', 'KeyN'],
  ['K7', 'Digit8', 'KeyI', 'KeyK', 'KeyM'],
  ['K8', 'Digit9', 'KeyO', 'KeyL', 'Comma'],
  ['K9', 'Digit0', 'KeyP', 'Semicolon', 'Period'],
  // The four symbol keys down the right-hand side. Their unshifted legends are
  // _ @ : / and their shifted ones = ` * ?, which is not a PC keyboard's
  // pairing - the token names below are the PMD 85's unshifted legend.
  ['K10', 'Underscore', 'At', 'Colon', 'Slash'],
  ['K11', 'BraceLeft', 'Backslash', 'BracketLeft', null],
  // The editing block. WRK selects the function keys' second bank; |<- and ->|
  // are the two tab keys.
  ['WRK', 'Ins', 'ArrowLeft', 'TabLeft', null],
  ['ClrDel', 'Del', 'ArrowUp', 'End', 'Enter'],
  ['Clr', 'Rcl', 'ArrowRight', 'TabRight', 'NumpadEnter'],
  [],
];

/**
 * The row SHIFT and STOP live in. It is never selected: its bits are ANDed into
 * whichever row the scan asked for, because the two keys are common to the
 * whole matrix.
 */
const MODIFIER_ROW = 15;

/** Where the two common keys sit in the byte port B returns. */
const MODIFIER_BITS: Readonly<Record<string, number>> = {
  Shift: 0x20,
  Stop: 0x40,
};

/** Bits 0-4 of a port B read are the selected row's five keys. */
const ROW_KEY_MASK = 0x1f;

/**
 * Host `KeyboardEvent.code`s that reach a PMD 85 key the browser spells
 * differently. Everything whose code already matches a token above - the
 * letters, the digits, Space, Comma, Period, the arrows - needs no entry.
 *
 * The symbol keys are mapped by the *character on the PMD 85 keycap*, not by
 * position: this keyboard's unshifted row of symbols is `_ @ : /`, which no PC
 * keyboard shares, so a positional mapping would put the wrong character on
 * screen for every one of them.
 */
const HOST_CODES: Readonly<Record<string, string>> = {
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ControlLeft: 'Stop',
  ControlRight: 'Stop',
  Minus: 'Underscore',
  Quote: 'Colon',
  BracketLeft: 'At',
  Backslash: 'Backslash',
  BracketRight: 'BracketLeft',
  Equal: 'BraceLeft',
  Backspace: 'Del',
  Home: 'ClrDel',
  End: 'End',
  Delete: 'Ins',
  PageUp: 'Clr',
  PageDown: 'Rcl',
  Tab: 'TabRight',
  Escape: 'K0',
};

interface KeyPosition {
  row: number;
  bit: number;
}

const KEY_POSITIONS = new Map<string, KeyPosition>();
ROWS.forEach((keys, row) =>
  keys.forEach((token, bit) => {
    if (token) KEY_POSITIONS.set(token, { row, bit });
  }),
);
for (const [token, bit] of Object.entries(MODIFIER_BITS)) {
  KEY_POSITIONS.set(token, { row: MODIFIER_ROW, bit: Math.log2(bit) });
}

/** Every token this keyboard answers to, for the layout tests to check against. */
export const PMD85_KEY_TOKENS: readonly string[] = [...KEY_POSITIONS.keys()];

/**
 * The PMD 85's keyboard as the motherboard 8255 sees it.
 *
 * The 8255 itself carries the speaker and the two front-panel LEDs on the same
 * port C, so the machine owns the chip's registers and this class owns only the
 * matrix - it is handed a row number and returns what port B would read.
 *
 * The PMD 85-1 evaluated an alphanumeric key when it was *released*, which made
 * holding a key down do nothing; the -2 this dialect models scans conventionally
 * and repeats. Nothing here models the difference, but it is the reason a -1
 * would need more than a new ROM.
 */
export class Pmd85Keyboard {
  /** Bit set = key down. Rows 0-14 are the matrix, row 15 SHIFT and STOP. */
  private readonly matrix = new Uint8Array(16);
  private readonly physicalDown = new Set<string>();
  private readonly virtualDown = new Set<string>();

  /**
   * A host key event, translated to whatever PMD 85 key sits under it. Returns
   * false for a key this machine has no equivalent of, so the browser keeps its
   * own handling of it.
   */
  handleEvent(e: KeyboardEvent, down: boolean): boolean {
    const token = HOST_CODES[e.code] ?? e.code;
    if (!KEY_POSITIONS.has(token)) return false;
    if (down) this.physicalDown.add(token);
    else this.physicalDown.delete(token);
    this.apply(token);
    return true;
  }

  /** A key pressed on the virtual keyboard, by layout token. */
  setKey(token: string, down: boolean): void {
    if (!KEY_POSITIONS.has(token)) return;
    if (down) this.virtualDown.add(token);
    else this.virtualDown.delete(token);
    this.apply(token);
  }

  releaseAll(): void {
    this.physicalDown.clear();
    this.virtualDown.clear();
    this.matrix.fill(0);
  }

  /**
   * What port B reads with `row` selected on port A: the row's five keys in
   * bits 0-4 and SHIFT/STOP in bits 5-6, all active low, with everything
   * unconnected reading high.
   */
  readRow(row: number): number {
    const keys = this.matrix[row & 0x0f]! & ROW_KEY_MASK;
    const modifiers = this.matrix[MODIFIER_ROW]!;
    return ~(keys | modifiers) & 0xff;
  }

  /** Sync one matrix cell with the union of the two press sources. */
  private apply(token: string): void {
    const position = KEY_POSITIONS.get(token);
    if (!position) return;
    const down =
      this.physicalDown.has(token) || this.virtualDown.has(token) ? 1 : 0;
    const mask = 1 << position.bit;
    if (down) this.matrix[position.row]! |= mask;
    else this.matrix[position.row]! &= ~mask & 0xff;
  }
}
