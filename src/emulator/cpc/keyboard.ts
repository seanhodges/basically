/**
 * The Amstrad CPC 464 keyboard: a 10-line × 8-bit matrix read a line at a time.
 * The PPI selects a line (0-9) on its port C low nibble; the AY's I/O port A
 * then reads that line back, one bit per key, ACTIVE LOW (a pressed key reads
 * 0). Line 9 doubles as joystick 0.
 *
 * Key tokens are DOM `KeyboardEvent.code` style strings so the virtual keyboard
 * and the physical `keyEvent` map share one vocabulary (the ZX81/Spectrum
 * precedent). {@link MATRIX} is the single source of truth; every other table
 * is derived from it.
 */

/**
 * matrix[line][bit] = key token, or null for an unused matrix cell. Each inner
 * array is ordered bit 0 → bit 7 (the low bit of the scanned byte first). This
 * is the authoritative CPC 464 matrix (cpctech.cpcwiki.de "keyboard"); a few
 * physical keys carry two legends (e.g. the `- =` key), named here by their
 * unshifted glyph.
 */
export const MATRIX: readonly (readonly (string | null)[])[] = [
  // line 0: 4 6 8 0 ^ Clr CurLeft CurUp
  [
    'Digit4',
    'Digit6',
    'Digit8',
    'Digit0',
    'Caret',
    'Clr',
    'CursorLeft',
    'CursorUp',
  ],
  // line 1: 3 5 7 9 - [ Copy CurRight
  [
    'Digit3',
    'Digit5',
    'Digit7',
    'Digit9',
    'Minus',
    'BracketOpen',
    'Copy',
    'CursorRight',
  ],
  // line 2: E R U O @ Return f7 CurDown
  ['E', 'R', 'U', 'O', 'At', 'Return', 'F7', 'CursorDown'],
  // line 3: W T Y I P ] f8 f9
  ['W', 'T', 'Y', 'I', 'P', 'BracketClose', 'F8', 'F9'],
  // line 4: S G H L ; f4 f5 f6
  ['S', 'G', 'H', 'L', 'Semicolon', 'F4', 'F5', 'F6'],
  // line 5: D F J K : Shift f1 f3
  ['D', 'F', 'J', 'K', 'Colon', 'Shift', 'F1', 'F3'],
  // line 6: C B N M / \ f2 Enter(keypad)
  ['C', 'B', 'N', 'M', 'Slash', 'Backslash', 'F2', 'Enter'],
  // line 7: X V Space . , Ctrl f0 f.(keypad)
  ['X', 'V', 'Space', 'Period', 'Comma', 'Control', 'F0', 'FDot'],
  // line 8: Z A CapsLock Tab (spare) Esc 2 1
  ['Z', 'A', 'CapsLock', 'Tab', null, 'Esc', 'Digit2', 'Digit1'],
  // line 9: Del Fire1 Fire2 Fire3 JoyRight JoyLeft JoyDown JoyUp
  [
    'Del',
    'JoyFire1',
    'JoyFire2',
    'JoyFire3',
    'JoyRight',
    'JoyLeft',
    'JoyDown',
    'JoyUp',
  ],
];

/** token → [line, bit], built once from {@link MATRIX}. */
const TOKEN_TO_CELL = new Map<string, [number, number]>();
for (let line = 0; line < MATRIX.length; line++) {
  for (let bit = 0; bit < 8; bit++) {
    const tok = MATRIX[line]![bit];
    if (tok) TOKEN_TO_CELL.set(tok, [line, bit]);
  }
}

/**
 * Map a browser `KeyboardEvent.code` to a matrix token. Only the physical keys
 * that exist on the CPC are mapped; anything else returns null and is left for
 * the browser. The numeric-keypad function keys map to the CPC's F0-F9 block.
 */
const CODE_TO_TOKEN: Record<string, string> = {
  ArrowUp: 'CursorUp',
  ArrowDown: 'CursorDown',
  ArrowLeft: 'CursorLeft',
  ArrowRight: 'CursorRight',
  Enter: 'Return',
  NumpadEnter: 'Enter',
  Space: 'Space',
  Backspace: 'Del',
  Delete: 'Clr',
  Escape: 'Esc',
  Tab: 'Tab',
  CapsLock: 'CapsLock',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ControlLeft: 'Control',
  ControlRight: 'Control',
  Minus: 'Minus',
  Semicolon: 'Semicolon',
  Quote: 'Colon',
  Slash: 'Slash',
  Period: 'Period',
  Comma: 'Comma',
  BracketLeft: 'BracketOpen',
  BracketRight: 'BracketClose',
  Backslash: 'Backslash',
  Backquote: 'At',
  Equal: 'Minus',
  Digit0: 'Digit0',
  Digit1: 'Digit1',
  Digit2: 'Digit2',
  Digit3: 'Digit3',
  Digit4: 'Digit4',
  Digit5: 'Digit5',
  Digit6: 'Digit6',
  Digit7: 'Digit7',
  Digit8: 'Digit8',
  Digit9: 'Digit9',
  Numpad0: 'F0',
  Numpad1: 'F1',
  Numpad2: 'F2',
  Numpad3: 'F3',
  Numpad4: 'F4',
  Numpad5: 'F5',
  Numpad6: 'F6',
  Numpad7: 'F7',
  Numpad8: 'F8',
  Numpad9: 'F9',
  NumpadDecimal: 'FDot',
};
for (let c = 65; c <= 90; c++)
  CODE_TO_TOKEN[`Key${String.fromCharCode(c)}`] = String.fromCharCode(c);

export class CpcKeyboard {
  /** One byte per line: bit set = key up. Active-low, so start all-ones. */
  private readonly lines = new Uint8Array(10).fill(0xff);

  /** Read a matrix line (0-9); unknown lines read 0xFF (nothing pressed). */
  readLine(line: number): number {
    return line >= 0 && line < 10 ? this.lines[line]! : 0xff;
  }

  /** Press (down=true) or release a matrix key by token. */
  setKey(token: string, down: boolean): void {
    const cell = TOKEN_TO_CELL.get(token);
    if (!cell) return;
    const [line, bit] = cell;
    if (down) this.lines[line]! &= ~(1 << bit) & 0xff;
    else this.lines[line]! |= 1 << bit;
  }

  /** Handle a physical key event; returns true when the key is on the CPC. */
  handleKey(e: KeyboardEvent, down: boolean): boolean {
    const token = CODE_TO_TOKEN[e.code];
    if (!token) return false;
    this.setKey(token, down);
    return true;
  }

  /** Release every key (stop / blur / unmount). */
  releaseAll(): void {
    this.lines.fill(0xff);
  }
}
