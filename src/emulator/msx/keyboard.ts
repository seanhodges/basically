// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The MSX key matrix: eleven rows of eight columns on an international
 * machine. The PPI selects a row on port C's low nibble and reads it back on
 * port B, active low - so the keyboard is the PPI's own business here, unlike
 * the Amstrad, where the same 8255 reads the matrix through the sound chip.
 *
 * Key tokens are an MSX-specific vocabulary shared by the virtual keyboard and
 * the physical `keyEvent` map: single letters `A`-`Z`, `Digit0`-`Digit9`, named
 * punctuation and control cells (`Semicolon`, `Return`, `Graph`, `Select`…) and
 * `CursorUp`/… - not raw DOM `KeyboardEvent.code`s. {@link MATRIX} is the
 * single source of truth; every other table is derived from it.
 */

/** Matrix rows on any MSX; the last two are the numeric keypad. */
export const MATRIX_ROWS = 11;
/** Rows the machines without a keypad answer; the rest read as all-released. */
export const KEYPAD_ROW = 9;

/**
 * matrix[row][bit] = key token, or null for a cell this layout leaves empty.
 * Each inner array is ordered bit 0 -> bit 7, the low bit of the scanned byte
 * first.
 *
 * Rows 0-5 are READ OFF THE MACHINE'S OWN BIOS: the character table the key
 * scanner indexes by (row x 8 + bit) sits at 0x0DA5 in this ROM and spells
 * `0123456789-=\[];'` then the pound sign, `,./`, an unused cell, then `a`-`z`
 * - so every printable cell below is the one this BIOS decodes rather than the
 * one a layout diagram claims. The pound sign at row 2 bit 1 is where a US
 * board has its backquote, and its neighbour at bit 5 is the international
 * layout's dead key, which this machine does not fit and its BIOS spells 0xFF.
 *
 * Rows 6-10 carry no character and so appear in no table; they are the
 * positions the MSX standard fixes for every machine in the family. The HB-10P
 * has no numeric keypad, so rows 9 and 10 are wired but never pressed.
 */
export const MATRIX: readonly (readonly (string | null)[])[] = [
  // row 0: 0 1 2 3 4 5 6 7
  [
    'Digit0',
    'Digit1',
    'Digit2',
    'Digit3',
    'Digit4',
    'Digit5',
    'Digit6',
    'Digit7',
  ],
  // row 1: 8 9 - = \ [ ] ;
  [
    'Digit8',
    'Digit9',
    'Minus',
    'Equal',
    'Backslash',
    'BracketOpen',
    'BracketClose',
    'Semicolon',
  ],
  // row 2: ' £ , . / (dead) A B
  ['Quote', 'Pound', 'Comma', 'Period', 'Slash', null, 'A', 'B'],
  // row 3: C D E F G H I J
  ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
  // row 4: K L M N O P Q R
  ['K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'],
  // row 5: S T U V W X Y Z
  ['S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
  // row 6: SHIFT CTRL GRAPH CAPS CODE F1 F2 F3
  ['Shift', 'Control', 'Graph', 'CapsLock', 'Code', 'F1', 'F2', 'F3'],
  // row 7: F4 F5 ESC TAB STOP BS SELECT RETURN
  ['F4', 'F5', 'Esc', 'Tab', 'Stop', 'Backspace', 'Select', 'Return'],
  // row 8: SPACE HOME INS DEL LEFT UP DOWN RIGHT
  [
    'Space',
    'Home',
    'Insert',
    'Delete',
    'CursorLeft',
    'CursorUp',
    'CursorDown',
    'CursorRight',
  ],
  // row 9 (keypad): * + / 0 1 2 3 4
  ['NumStar', 'NumPlus', 'NumSlash', 'Num0', 'Num1', 'Num2', 'Num3', 'Num4'],
  // row 10 (keypad): 5 6 7 8 9 - , .
  ['Num5', 'Num6', 'Num7', 'Num8', 'Num9', 'NumMinus', 'NumComma', 'NumPeriod'],
];

/** token -> [row, bit], built once from {@link MATRIX}. */
const TOKEN_TO_CELL = new Map<string, [number, number]>();
for (let row = 0; row < MATRIX.length; row++) {
  for (let bit = 0; bit < 8; bit++) {
    const token = MATRIX[row]![bit];
    if (token) TOKEN_TO_CELL.set(token, [row, bit]);
  }
}

/**
 * Map a browser `KeyboardEvent.code` to a matrix token. Only keys the MSX has
 * are mapped; anything else returns null and is left to the browser. The host's
 * numeric keypad reaches the MSX keypad even on a machine that has none, so a
 * later model needs no second table.
 */
export const CODE_TO_TOKEN: Record<string, string> = {
  Enter: 'Return',
  NumpadEnter: 'Return',
  Space: 'Space',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  Escape: 'Esc',
  Tab: 'Tab',
  CapsLock: 'CapsLock',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ControlLeft: 'Control',
  ControlRight: 'Control',
  AltLeft: 'Graph',
  AltRight: 'Code',
  Pause: 'Stop',
  F1: 'F1',
  F2: 'F2',
  F3: 'F3',
  F4: 'F4',
  F5: 'F5',
  F6: 'Select',
  ArrowUp: 'CursorUp',
  ArrowDown: 'CursorDown',
  ArrowLeft: 'CursorLeft',
  ArrowRight: 'CursorRight',
  Minus: 'Minus',
  Equal: 'Equal',
  BracketLeft: 'BracketOpen',
  BracketRight: 'BracketClose',
  Backslash: 'Backslash',
  Semicolon: 'Semicolon',
  Quote: 'Quote',
  Comma: 'Comma',
  Period: 'Period',
  Slash: 'Slash',
  // The MSX's pound key sits where a US board has its backquote, and an ISO
  // board's extra key by the left shift is the nearest thing to a second one.
  Backquote: 'Pound',
  IntlBackslash: 'Pound',
  NumpadMultiply: 'NumStar',
  NumpadAdd: 'NumPlus',
  NumpadSubtract: 'NumMinus',
  NumpadDivide: 'NumSlash',
  NumpadDecimal: 'NumPeriod',
  NumpadComma: 'NumComma',
};
for (let c = 65; c <= 90; c++) {
  CODE_TO_TOKEN[`Key${String.fromCharCode(c)}`] = String.fromCharCode(c);
}
for (let d = 0; d <= 9; d++) {
  CODE_TO_TOKEN[`Digit${d}`] = `Digit${d}`;
  CODE_TO_TOKEN[`Numpad${d}`] = `Num${d}`;
}

export class MsxKeyboard {
  /** One byte per row: bit set = key up. Active-low, so start all-ones. */
  private readonly rows = new Uint8Array(MATRIX_ROWS).fill(0xff);
  /** False on a machine with no numeric keypad, whose last two rows read idle. */
  private readonly hasKeypad: boolean;

  constructor(opts: { hasKeypad?: boolean } = {}) {
    this.hasKeypad = opts.hasKeypad ?? false;
  }

  /** Press or release an opaque key token from the virtual keyboard. */
  setKey(token: string, down: boolean): void {
    const cell = TOKEN_TO_CELL.get(token);
    if (cell) this.pressRaw(cell[0], cell[1], down);
  }

  /** Press/release a raw matrix cell (row 0-10, bit 0-7); active-low. */
  pressRaw(row: number, bit: number, down: boolean): void {
    if (row < 0 || row >= MATRIX_ROWS || bit < 0 || bit >= 8) return;
    if (down) this.rows[row]! &= ~(1 << bit) & 0xff;
    else this.rows[row]! |= 1 << bit;
  }

  /** Handle a physical key event; true when the key exists on this machine. */
  handleKey(e: KeyboardEvent, down: boolean): boolean {
    const token = CODE_TO_TOKEN[e.code];
    if (!token) return false;
    this.setKey(token, down);
    return true;
  }

  releaseAll(): void {
    this.rows.fill(0xff);
  }

  /**
   * The selected matrix row as the PPI's port B reads it. A row past the matrix
   * - the scanner sweeps the whole low nibble, and there are sixteen values for
   * eleven rows - and the keypad rows of a machine with no keypad both read
   * 0xFF, which is what the hardware's unconnected column pull-ups give.
   */
  readRow(row: number): number {
    if (row < 0 || row >= MATRIX_ROWS) return 0xff;
    if (row >= KEYPAD_ROW && !this.hasKeypad) return 0xff;
    return this.rows[row]!;
  }
}
