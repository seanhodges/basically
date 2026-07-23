/**
 * The Amstrad CPC 464 keyboard: a 10-line × 8-bit matrix read a line at a time.
 * The PPI selects a line (0-9) on its port C low nibble; the AY's I/O port A
 * then reads that line back, one bit per key, ACTIVE LOW (a pressed key reads
 * 0). Line 9 doubles as joystick 0.
 *
 * Key tokens are a CPC-specific vocabulary shared by the virtual keyboard and
 * the physical `keyEvent` map (`CODE_TO_TOKEN`): single letters `A`-`Z`,
 * `Digit0`-`Digit9`, named punctuation/control cells (`BracketOpen`, `At`,
 * `Return`, `Del`, `Copy`, `Esc`…) and `CursorUp`/… - not raw DOM
 * `KeyboardEvent.code`s. {@link MATRIX} is the single source of truth; every
 * other table is derived from it.
 */

/**
 * matrix[line][bit] = key token, or null for an unused matrix cell. Each inner
 * array is ordered bit 0 → bit 7 (the low bit of the scanned byte first).
 *
 * This is the CPC 464 matrix as read back FROM THE REAL FIRMWARE: every
 * printable cell (lines 3-8), Return, Del and the numeric-keypad function keys
 * (f0-f9, f.) were reverse-engineered by pressing each (line,bit) on the booted
 * ROM and OCR-ing the echoed glyph, so `setKey` drives exactly the cell the
 * firmware decodes. The remaining control cells (cursor cluster, Shift, Ctrl,
 * Esc, Tab, Caps, Copy, Clr, keypad Enter and the joystick row) are the
 * canonical CPC positions.
 */
export const MATRIX: readonly (readonly (string | null)[])[] = [
  // line 0: CurUp CurRight CurDown f9 f6 f3 Enter(keypad) f.
  ['CursorUp', 'CursorRight', 'CursorDown', 'F9', 'F6', 'F3', 'Enter', 'FDot'],
  // line 1: CurLeft Copy f7 f8 f5 f1 f2 f0
  ['CursorLeft', 'Copy', 'F7', 'F8', 'F5', 'F1', 'F2', 'F0'],
  // line 2: Clr [ Return ] f4 Shift \ Ctrl
  [
    'Clr',
    'BracketOpen',
    'Return',
    'BracketClose',
    'F4',
    'Shift',
    'Backslash',
    'Control',
  ],
  // line 3: ^ - @ P ; : / .
  ['Caret', 'Minus', 'At', 'P', 'Semicolon', 'Colon', 'Slash', 'Period'],
  // line 4: 0 9 O I L K M ,
  ['Digit0', 'Digit9', 'O', 'I', 'L', 'K', 'M', 'Comma'],
  // line 5: 8 7 U Y H J N Space
  ['Digit8', 'Digit7', 'U', 'Y', 'H', 'J', 'N', 'Space'],
  // line 6: 6 5 R T G F B V
  ['Digit6', 'Digit5', 'R', 'T', 'G', 'F', 'B', 'V'],
  // line 7: 4 3 E W S D C X
  ['Digit4', 'Digit3', 'E', 'W', 'S', 'D', 'C', 'X'],
  // line 8: 1 2 Esc Q Tab A CapsLock Z
  ['Digit1', 'Digit2', 'Esc', 'Q', 'Tab', 'A', 'CapsLock', 'Z'],
  // line 9: joystick 0 + Del
  [
    'JoyUp',
    'JoyDown',
    'JoyLeft',
    'JoyRight',
    'JoyFire2',
    'JoyFire1',
    'JoySpare',
    'Del',
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
 *
 * Exported so the virtual-keyboard layout tests can assert that the physical map
 * and the on-screen layout together reach every (non-joystick) matrix cell.
 */
export const CODE_TO_TOKEN: Record<string, string> = {
  ArrowUp: 'CursorUp',
  ArrowDown: 'CursorDown',
  ArrowLeft: 'CursorLeft',
  ArrowRight: 'CursorRight',
  Enter: 'Return',
  NumpadEnter: 'Enter',
  Space: 'Space',
  Backspace: 'Del',
  Delete: 'Clr',
  End: 'Copy',
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
  // ISO keyboards' extra key by the left Shift stands in for the CPC's
  // dedicated ^/£ key, the one CPC printable with no natural US-PC code.
  IntlBackslash: 'Caret',
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
    this.pressRaw(cell[0], cell[1], down);
  }

  /** Press/release a raw matrix cell (line 0-9, bit 0-7); active-low. */
  pressRaw(line: number, bit: number, down: boolean): void {
    if (line < 0 || line >= 10 || bit < 0 || bit >= 8) return;
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
