import type { MatrixPos } from '../commodore/machineHelpers';

/**
 * The VIC-20 keyboard as an 8×8 matrix, driven on VIA #2: the CPU selects a
 * column by pulling a PORT B line low and reads the pressed rows back on PORT A
 * (both active-low). Each entry is `[column, row]` — the same `[col, row]`
 * convention and token vocabulary as the C64 adapter, which the Stage 2 plan
 * reuses verbatim because the two matrices are nearly identical. Stage 3 pairs
 * this with the on-screen `keyboardLayout` and adds matrix-coverage tests; the
 * Stage 2 boot path types `RUN` through the keyboard *buffer*, not the matrix,
 * so it does not depend on these positions.
 *
 * Token names follow the viciious button vocabulary (letters verbatim, digits
 * `Num0`–`Num9`, `Return`/`Space`/…). Restore is omitted: like the C64 it is
 * wired to NMI, not the matrix.
 */
export const VIC20_KEY_MATRIX: Record<string, MatrixPos> = {
  RunStop: [7, 7],
  Q: [7, 6],
  Commodore: [7, 5],
  Space: [7, 4],
  Num2: [7, 3],
  Ctrl: [7, 2],
  LeftArrow: [7, 1],
  Num1: [7, 0],
  Slash: [6, 7],
  UpArrow: [6, 6],
  Equal: [6, 5],
  RightShift: [6, 4],
  ClrHome: [6, 3],
  Semicolon: [6, 2],
  Asterisk: [6, 1],
  Pound: [6, 0],
  Comma: [5, 7],
  At: [5, 6],
  Colon: [5, 5],
  Period: [5, 4],
  Minus: [5, 3],
  L: [5, 2],
  P: [5, 1],
  Plus: [5, 0],
  N: [4, 7],
  O: [4, 6],
  K: [4, 5],
  M: [4, 4],
  Num0: [4, 3],
  J: [4, 2],
  I: [4, 1],
  Num9: [4, 0],
  V: [3, 7],
  U: [3, 6],
  H: [3, 5],
  B: [3, 4],
  Num8: [3, 3],
  G: [3, 2],
  Y: [3, 1],
  Num7: [3, 0],
  X: [2, 7],
  T: [2, 6],
  F: [2, 5],
  C: [2, 4],
  Num6: [2, 3],
  D: [2, 2],
  R: [2, 1],
  Num5: [2, 0],
  LeftShift: [1, 7],
  E: [1, 6],
  S: [1, 5],
  Z: [1, 4],
  Num4: [1, 3],
  A: [1, 2],
  W: [1, 1],
  Num3: [1, 0],
  CursorDown: [0, 7],
  F5: [0, 6],
  F3: [0, 5],
  F1: [0, 4],
  F7: [0, 3],
  CursorRight: [0, 2],
  Return: [0, 1],
  InstDel: [0, 0],
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
