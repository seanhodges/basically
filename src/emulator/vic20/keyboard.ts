import type { MatrixPos } from '../commodore/machineHelpers';

/**
 * The VIC-20 keyboard as an 8×8 matrix, driven on VIA #2: the CPU selects a
 * column by pulling a PORT B line low and reads the pressed rows back on PORT A
 * (both active-low). Each entry is `[column, row]` — column is the PB select
 * line, row is the PA read line ({@link Vic20Machine.keyboardRows} scans it as
 * `keyMatrix[column]` with a bit set per pressed row).
 *
 * The token *vocabulary* matches the C64 adapter (letters verbatim, digits
 * `Num0`–`Num9`, `Return`/`Space`/…) so the shared virtual-keyboard layout and
 * controller bindings resolve on either machine — but the physical *wiring* does
 * not: the VIC-20 and C64 have different keyboard matrices (roughly transposed),
 * so the positions below are the VIC-20's own, taken from the VIC-20
 * Programmer's Reference Guide, not the C64 table. Restore is omitted: like the
 * C64 it is wired to NMI, not the matrix.
 */
export const VIC20_KEY_MATRIX: Record<string, MatrixPos> = {
  // Column 0 (PB0)
  Num1: [0, 0],
  Num3: [0, 1],
  Num5: [0, 2],
  Num7: [0, 3],
  Num9: [0, 4],
  Plus: [0, 5],
  Pound: [0, 6],
  InstDel: [0, 7],
  // Column 1 (PB1)
  LeftArrow: [1, 0],
  W: [1, 1],
  R: [1, 2],
  Y: [1, 3],
  I: [1, 4],
  P: [1, 5],
  Asterisk: [1, 6],
  Return: [1, 7],
  // Column 2 (PB2)
  Ctrl: [2, 0],
  A: [2, 1],
  D: [2, 2],
  G: [2, 3],
  J: [2, 4],
  L: [2, 5],
  Semicolon: [2, 6],
  CursorRight: [2, 7],
  // Column 3 (PB3)
  RunStop: [3, 0],
  LeftShift: [3, 1],
  X: [3, 2],
  V: [3, 3],
  N: [3, 4],
  Comma: [3, 5],
  Slash: [3, 6],
  CursorDown: [3, 7],
  // Column 4 (PB4)
  Space: [4, 0],
  Z: [4, 1],
  C: [4, 2],
  B: [4, 3],
  M: [4, 4],
  Period: [4, 5],
  RightShift: [4, 6],
  F1: [4, 7],
  // Column 5 (PB5)
  Commodore: [5, 0],
  S: [5, 1],
  F: [5, 2],
  H: [5, 3],
  K: [5, 4],
  Colon: [5, 5],
  Equal: [5, 6],
  F3: [5, 7],
  // Column 6 (PB6)
  Q: [6, 0],
  E: [6, 1],
  T: [6, 2],
  U: [6, 3],
  O: [6, 4],
  At: [6, 5],
  UpArrow: [6, 6],
  F5: [6, 7],
  // Column 7 (PB7)
  Num2: [7, 0],
  Num4: [7, 1],
  Num6: [7, 2],
  Num8: [7, 3],
  Num0: [7, 4],
  Minus: [7, 5],
  ClrHome: [7, 6],
  F7: [7, 7],
};

/**
 * Resolve a keyboard token to matrix positions. Cursor-up and cursor-left have
 * no key of their own — they are Shift + down / Shift + right, exactly as on the
 * real machine — so they expand to two positions. Unknown tokens map to none.
 */
export function vic20TokenToPositions(token: string): readonly MatrixPos[] {
  switch (token) {
    case 'CursorUp':
      return [VIC20_KEY_MATRIX.LeftShift!, VIC20_KEY_MATRIX.CursorDown!];
    case 'CursorLeft':
      return [VIC20_KEY_MATRIX.LeftShift!, VIC20_KEY_MATRIX.CursorRight!];
    default: {
      const pos = VIC20_KEY_MATRIX[token];
      return pos ? [pos] : [];
    }
  }
}

/** Map a DOM `KeyboardEvent.code` to VIC-20 key token(s), or none if unbound. */
export function vic20DomCodeToTokens(code: string): readonly string[] {
  if (/^Key[A-Z]$/.test(code)) return [code.slice(3)];
  if (/^Digit[0-9]$/.test(code)) return ['Num' + code.slice(5)];
  const map: Record<string, string> = {
    Enter: 'Return',
    NumpadEnter: 'Return',
    Backspace: 'InstDel',
    Delete: 'InstDel',
    Space: 'Space',
    ShiftLeft: 'LeftShift',
    ShiftRight: 'RightShift',
    ControlLeft: 'Ctrl',
    ControlRight: 'Ctrl',
    ArrowDown: 'CursorDown',
    ArrowRight: 'CursorRight',
    ArrowUp: 'CursorUp',
    ArrowLeft: 'CursorLeft',
    Comma: 'Comma',
    Period: 'Period',
    Slash: 'Slash',
    Semicolon: 'Semicolon',
    Quote: 'Colon',
    Minus: 'Minus',
    Equal: 'Equal',
    Home: 'ClrHome',
    Escape: 'RunStop',
    F1: 'F1',
    F3: 'F3',
    F5: 'F5',
    F7: 'F7',
  };
  const t = map[code];
  return t ? [t] : [];
}
