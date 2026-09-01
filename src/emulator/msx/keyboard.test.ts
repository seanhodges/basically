import { describe, expect, it } from 'vitest';
import { CODE_TO_TOKEN, KEYPAD_ROW, MATRIX, MsxKeyboard } from './keyboard';

describe('MsxKeyboard', () => {
  it('presses exactly the cell each token names, active low', () => {
    const keys = new MsxKeyboard({ hasKeypad: true });
    for (let row = 0; row < MATRIX.length; row++) {
      for (let bit = 0; bit < 8; bit++) {
        const token = MATRIX[row]![bit];
        if (!token) continue;
        keys.setKey(token, true);
        expect(keys.readRow(row), `${token} sets row ${row}`).toBe(
          0xff & ~(1 << bit),
        );
        keys.setKey(token, false);
        expect(keys.readRow(row)).toBe(0xff);
      }
    }
  });

  it('gives every cell a token exactly once, bar the layout gap', () => {
    const seen = new Map<string, string>();
    let empty = 0;
    for (let row = 0; row < MATRIX.length; row++) {
      for (let bit = 0; bit < 8; bit++) {
        const token = MATRIX[row]![bit];
        if (!token) {
          empty++;
          continue;
        }
        expect(seen.has(token), `${token} is in two cells`).toBe(false);
        seen.set(token, `${row}.${bit}`);
      }
    }
    // The one empty cell is the international layout's dead key, which this
    // machine does not fit and whose BIOS table entry is 0xFF.
    expect(empty).toBe(1);
    expect(seen.size).toBe(MATRIX.length * 8 - 1);
  });

  it('reads the keypad rows as idle on a machine with no keypad', () => {
    const none = new MsxKeyboard();
    const fitted = new MsxKeyboard({ hasKeypad: true });
    for (const keys of [none, fitted]) keys.setKey('Num5', true);
    expect(none.readRow(KEYPAD_ROW + 1)).toBe(0xff);
    expect(fitted.readRow(KEYPAD_ROW + 1)).toBe(0xfe);
    // The scanner sweeps the whole low nibble, so the rows past the matrix are
    // asked for and have to answer.
    expect(none.readRow(15)).toBe(0xff);
  });

  it('maps host key codes onto tokens the matrix has', () => {
    const tokens = new Set(MATRIX.flat().filter((t): t is string => !!t));
    for (const [code, token] of Object.entries(CODE_TO_TOKEN)) {
      expect(tokens.has(token), `${code} -> ${token}`).toBe(true);
    }
    const keys = new MsxKeyboard();
    expect(keys.handleKey({ code: 'KeyA' } as KeyboardEvent, true)).toBe(true);
    expect(keys.readRow(2)).toBe(0xff & ~(1 << 6));
    expect(keys.handleKey({ code: 'F12' } as KeyboardEvent, true)).toBe(false);
  });

  it('releases everything at once', () => {
    const keys = new MsxKeyboard({ hasKeypad: true });
    keys.setKey('A', true);
    keys.setKey('Shift', true);
    keys.releaseAll();
    for (let row = 0; row < MATRIX.length; row++) {
      expect(keys.readRow(row)).toBe(0xff);
    }
  });
});
