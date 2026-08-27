// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The Atari 400/800 keyboard: a matrix POKEY scans, reported as one code.
 *
 * The machine never sees a key matrix. POKEY scans it in hardware and, when the
 * scan stops on a closed key, leaves that key's position in KBCODE - six bits
 * of position, plus SHIFT in bit 6 and CTRL in bit 7. Only one key is reported
 * at a time; SHIFT and CTRL are the two exceptions, being read on separate
 * lines. So a "key token" here maps to a single code rather than to a matrix
 * position, and the two modifiers are held alongside it.
 *
 * The codes are the machine's own and are not in any tidy order - `L` is 0 and
 * `J` is 1 - because they are wire positions in the matrix rather than a
 * character set. The four console keys are not in the matrix at all: START,
 * SELECT and OPTION are three lines into GTIA, and RESET is wired to the CPU.
 * BREAK is a key POKEY watches on its own line, which is why a program can be
 * stopped while it is not reading the keyboard.
 */

/**
 * Tokens that are not matrix keys: the three console buttons GTIA reads, the
 * BREAK key POKEY watches, and the SHIFT and CTRL lines themselves.
 */
import { KB_SHIFT } from './pokey';

export const CONSOLE_TOKENS = ['Start', 'Select', 'Option'] as const;
export const BREAK_TOKEN = 'Break';
export const SHIFT_TOKENS = ['Shift', 'LeftShift', 'RightShift'] as const;
export const CTRL_TOKENS = ['Ctrl', 'Control'] as const;

/**
 * Every key in the matrix, by the token the on-screen keyboard names it with.
 * The values are KBCODE positions, read off the machine's own scan order.
 */
export const ATARI_KEY_CODES: Record<string, number> = {
  A: 0x3f,
  B: 0x15,
  C: 0x12,
  D: 0x3a,
  E: 0x2a,
  F: 0x38,
  G: 0x3d,
  H: 0x39,
  I: 0x0d,
  J: 0x01,
  K: 0x05,
  L: 0x00,
  M: 0x25,
  N: 0x23,
  O: 0x08,
  P: 0x0a,
  Q: 0x2f,
  R: 0x28,
  S: 0x3e,
  T: 0x2d,
  U: 0x0b,
  V: 0x10,
  W: 0x2e,
  X: 0x16,
  Y: 0x2b,
  Z: 0x17,

  Num0: 0x32,
  Num1: 0x1f,
  Num2: 0x1e,
  Num3: 0x1a,
  Num4: 0x18,
  Num5: 0x1d,
  Num6: 0x1b,
  Num7: 0x33,
  Num8: 0x35,
  Num9: 0x30,

  Comma: 0x20,
  Period: 0x22,
  Slash: 0x26,
  Semicolon: 0x02,
  Equal: 0x0f,
  Minus: 0x0e,
  Plus: 0x06,
  Asterisk: 0x07,
  Less: 0x36,
  Greater: 0x37,

  Space: 0x21,
  Return: 0x0c,
  Escape: 0x1c,
  Tab: 0x2c,
  Backspace: 0x34,
  CapsLock: 0x3c,
  Atari: 0x27,
  Help: 0x11,
};

/**
 * The four cursor keys, which have no keys of their own: they are CTRL and one
 * of `-`, `=`, `+` and `*`, exactly as the key caps say.
 */
const CURSOR_KEYS: Record<string, string> = {
  CursorUp: 'Minus',
  CursorDown: 'Equal',
  CursorLeft: 'Plus',
  CursorRight: 'Asterisk',
};

/** Whether a token names one of the cursor keys. */
export function cursorKey(token: string): string | undefined {
  return CURSOR_KEYS[token];
}

/** The KBCODE position a token presses, or -1 where it is not a matrix key. */
export function atariKeyCode(token: string): number {
  const cursor = CURSOR_KEYS[token];
  if (cursor !== undefined) return ATARI_KEY_CODES[cursor]!;
  const code = ATARI_KEY_CODES[token];
  return code === undefined ? -1 : code;
}

/** Map a DOM `KeyboardEvent.code` to an Atari key token, or none if unbound. */
export function atariDomCodeToToken(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return 'Num' + code.slice(5);
  return DOM_CODES[code] ?? null;
}

const DOM_CODES: Record<string, string> = {
  Enter: 'Return',
  NumpadEnter: 'Return',
  Space: 'Space',
  Backspace: 'Backspace',
  Delete: 'Backspace',
  Tab: 'Tab',
  Escape: 'Escape',
  CapsLock: 'CapsLock',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
  AltLeft: 'Atari',
  AltRight: 'Atari',
  ArrowUp: 'CursorUp',
  ArrowDown: 'CursorDown',
  ArrowLeft: 'CursorLeft',
  ArrowRight: 'CursorRight',
  Comma: 'Comma',
  Period: 'Period',
  Slash: 'Slash',
  Semicolon: 'Semicolon',
  Equal: 'Equal',
  Minus: 'Minus',
  F1: 'Break',
  Pause: 'Break',
  Home: 'Start',
  End: 'Select',
  PageDown: 'Option',
  Insert: 'Help',
};

/**
 * The KBCODE for a character a program wants typed, or -1 where the character
 * has no key. Used to type at the emulated keyboard - the injected `RUN`, and
 * the tests that make the ROM tokenize a listing for them.
 */
export function atariCodeForChar(ch: string): number {
  const direct = CHAR_KEYS[ch];
  if (direct !== undefined) return direct;
  if (ch >= 'a' && ch <= 'z') return ATARI_KEY_CODES[ch.toUpperCase()]!;
  if (ch >= 'A' && ch <= 'Z') return ATARI_KEY_CODES[ch]! | KB_SHIFT;
  if (ch >= '0' && ch <= '9') return ATARI_KEY_CODES['Num' + ch]!;
  return -1;
}

/**
 * Characters that reach a key of their own, or a named key with SHIFT already
 * folded into the code - `!` is {@link KB_SHIFT} over the `1` key.
 */
const CHAR_KEYS: Record<string, number> = {
  ' ': 0x21,
  '\n': 0x0c,
  ',': 0x20,
  '.': 0x22,
  '/': 0x26,
  ';': 0x02,
  '=': 0x0f,
  '-': 0x0e,
  '+': 0x06,
  '*': 0x07,
  '<': 0x36,
  '>': 0x37,
  '!': 0x5f,
  '"': 0x5e,
  '#': 0x5a,
  $: 0x58,
  '%': 0x5d,
  '&': 0x5b,
  "'": 0x73,
  '@': 0x75,
  '(': 0x70,
  ')': 0x72,
  '?': 0x66,
  ':': 0x42,
  _: 0x4e,
  '[': 0x60,
  ']': 0x62,
  '^': 0x47,
  '\\': 0x46,
  '|': 0x4f,
};
