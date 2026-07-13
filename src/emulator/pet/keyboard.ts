import type { MatrixPos } from '../commodore/machineHelpers';

/**
 * The Commodore PET **graphics keyboard** matrix: 10 rows (selected by writing
 * 0–9 to PIA1 PORT A's low nibble, which drives a 4→10 decoder) × 8 columns
 * (read back on PORT B, active-low). Each entry is `[row, column-bit]`.
 *
 * Transcribed from the PET I/O reference (zimmers.net PETio.txt), which matches
 * VICE's positional graphics-keyboard map. Tokens follow the C64 adapter's
 * naming (letters verbatim, digits `Num0`–`Num9`, `Return`/`Space`/…) so the
 * Stage 3 `keyboardLayout` and this machine agree. The graphics keyboard has no
 * Commodore key and scatters its digits and symbols differently from the
 * business keyboard.
 */
export const PET_KEY_MATRIX: Record<string, MatrixPos> = {
  // Letters.
  A: [4, 0],
  B: [6, 2],
  C: [6, 1],
  D: [4, 1],
  E: [2, 1],
  F: [5, 1],
  G: [4, 2],
  H: [5, 2],
  I: [3, 3],
  J: [4, 3],
  K: [5, 3],
  L: [4, 4],
  M: [6, 3],
  N: [7, 2],
  O: [2, 4],
  P: [3, 4],
  Q: [2, 0],
  R: [3, 1],
  S: [5, 0],
  T: [2, 2],
  U: [2, 3],
  V: [7, 1],
  W: [3, 0],
  X: [7, 0],
  Y: [3, 2],
  Z: [6, 0],
  // Digits.
  Num0: [8, 6],
  Num1: [6, 6],
  Num2: [7, 6],
  Num3: [6, 7],
  Num4: [4, 6],
  Num5: [5, 6],
  Num6: [4, 7],
  Num7: [2, 6],
  Num8: [3, 6],
  Num9: [2, 7],
  // Editing / control.
  Return: [6, 5],
  Space: [9, 2],
  RunStop: [9, 4],
  LeftShift: [8, 0],
  RightShift: [8, 5],
  Rvs: [9, 0],
  ClrHome: [0, 6],
  InstDel: [1, 7],
  CursorRight: [0, 7],
  CursorDown: [1, 6],
  UpArrow: [2, 5],
  LeftArrow: [0, 5],
  // Punctuation (direct keys on the graphics keyboard, not shifted digits).
  '!': [0, 0],
  '#': [0, 1],
  '%': [0, 2],
  '&': [0, 3],
  '(': [0, 4],
  '"': [1, 0],
  $: [1, 1],
  "'": [1, 2],
  '\\': [1, 3],
  ')': [1, 4],
  '@': [8, 1],
  ']': [8, 2],
  '>': [8, 4],
  '-': [8, 7],
  '[': [9, 1],
  '<': [9, 3],
  '.': [9, 6],
  '=': [9, 7],
  ';': [6, 4],
  ':': [5, 4],
  '*': [5, 7],
  ',': [7, 3],
  '?': [7, 4],
  '+': [7, 7],
  '/': [3, 7],
};

/**
 * Resolve a key token to matrix positions. Cursor-left and cursor-up have no
 * key of their own — they are Shift + right / Shift + down, exactly as on the
 * real machine — so they expand to two positions. Unknown tokens map to none.
 */
export function petTokenToPositions(token: string): readonly MatrixPos[] {
  switch (token) {
    case 'CursorLeft':
      return [PET_KEY_MATRIX.LeftShift!, PET_KEY_MATRIX.CursorRight!];
    case 'CursorUp':
      return [PET_KEY_MATRIX.LeftShift!, PET_KEY_MATRIX.CursorDown!];
    default: {
      const pos = PET_KEY_MATRIX[token];
      return pos ? [pos] : [];
    }
  }
}

/** Map a DOM `KeyboardEvent.code` to a PET key token (or null if unbound). */
export function petDomCodeToToken(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return 'Num' + code.slice(5);
  const map: Record<string, string> = {
    Enter: 'Return',
    NumpadEnter: 'Return',
    Space: 'Space',
    Backspace: 'InstDel',
    Delete: 'InstDel',
    ShiftLeft: 'LeftShift',
    ShiftRight: 'RightShift',
    ArrowRight: 'CursorRight',
    ArrowLeft: 'CursorLeft',
    ArrowDown: 'CursorDown',
    ArrowUp: 'CursorUp',
    Home: 'ClrHome',
    Escape: 'RunStop',
    Comma: ',',
    Period: '.',
    Slash: '/',
    Semicolon: ';',
    Quote: "'",
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
  };
  return map[code] ?? null;
}
