// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeyDef, KeyboardLayout } from '../../keyboard/layoutSchema';
import { bottomRow } from '../../keyboard/templateRows';

/**
 * The on-screen PMD 85-2 keyboard, on the project's five-band template.
 *
 * Every legend below is the Monitor's own, not a guess: the firmware carries a
 * key-code table at 0x82D0 - ten lines of `[mask, 15 codes]`, one line per
 * matrix bit with and without SHIFT - and `keyboardLayout.test.ts` reads it out
 * of the shipped ROM and compares it cell by cell against this file. Two of the
 * consequences would look like typos otherwise:
 *
 *  - **The keyboard is QWERTZ.** This is a Czechoslovak machine: `Z` sits where
 *    a QWERTY board has `Y` and vice versa. The matrix tokens are DOM
 *    `KeyboardEvent.code` names, which are positional, so the key that emits
 *    `KeyY` carries the legend `Z` and the one that emits `KeyZ` carries `Y`.
 *  - **SHIFT gives lower case, not upper.** Unshifted keys type capitals -
 *    which is what BASIC-G is written in - and SHIFT reaches the lower case and
 *    the symbol set. Nothing about the layout is upside down; the machine is.
 *
 * The machine's own key grid is fifteen columns wide: twelve of alphanumerics
 * and symbols, then a three-column editing block down the right-hand side. The
 * twelve are exactly the four typing bands here, so those rows are the real
 * keyboard. The editing block is redistributed rather than reproduced, because
 * fifteen keycaps to a row is narrower than a thumb: its top row (WRK, C-D,
 * CLR) joins the function keys in the top strip, the cursor and tab keys go to
 * the bottom band, and DEL and ENTER end the last typing row where a hand
 * expects them.
 *
 * Four matrix keys therefore have no keycap - INS, RCL, END and the numeric
 * ENTER - and are reached from the host keyboard instead (Delete, PageDown, End
 * and NumpadEnter; see `emulator/keyboard.ts`). The layout test checks that
 * union rather than the layout alone, so a token reachable by neither route
 * fails.
 */

/**
 * Twelve keys to a row rather than the template's ten, at the template's own
 * key width - the PMD 85's alphanumeric block is twelve columns wide, and
 * dropping two of them would cost the `^` the power operator needs and the `_`
 * that is a BASIC-G keyword in its own right.
 */
const GRID_COLUMNS = 48;

/** Base and SHIFT legends for one printing key, index-aligned with `layers`. */
function key(token: string, main: string, shift: string): KeyDef {
  return {
    id: token,
    spanX: 4,
    emits: [token],
    labels: [{ text: main }, { text: shift }],
  };
}

// The two rightmost columns of every typing band are symbol keys, and their
// pairings are the machine's rather than a PC's: `_`/`=`, `}`/`{`, `@`/`` ` ``,
// `\`/`^`, `:`/`*`, `]`/`[`.
const numberRow: KeyDef[] = [
  key('Digit1', '1', '!'),
  key('Digit2', '2', '"'),
  key('Digit3', '3', '#'),
  key('Digit4', '4', '$'),
  key('Digit5', '5', '%'),
  key('Digit6', '6', '&'),
  key('Digit7', '7', "'"),
  key('Digit8', '8', '('),
  key('Digit9', '9', ')'),
  key('Digit0', '0', '-'),
  key('Underscore', '_', '='),
  key('BraceLeft', '}', '{'),
];

const qwertzRow: KeyDef[] = [
  key('KeyQ', 'Q', 'q'),
  key('KeyW', 'W', 'w'),
  key('KeyE', 'E', 'e'),
  key('KeyR', 'R', 'r'),
  key('KeyT', 'T', 't'),
  key('KeyY', 'Z', 'z'),
  key('KeyU', 'U', 'u'),
  key('KeyI', 'I', 'i'),
  key('KeyO', 'O', 'o'),
  key('KeyP', 'P', 'p'),
  key('At', '@', '`'),
  key('Backslash', '\\', '^'),
];

const homeRow: KeyDef[] = [
  key('KeyA', 'A', 'a'),
  key('KeyS', 'S', 's'),
  key('KeyD', 'D', 'd'),
  key('KeyF', 'F', 'f'),
  key('KeyG', 'G', 'g'),
  key('KeyH', 'H', 'h'),
  key('KeyJ', 'J', 'j'),
  key('KeyK', 'K', 'k'),
  key('KeyL', 'L', 'l'),
  key('Semicolon', ';', '+'),
  key('Colon', ':', '*'),
  key('BracketLeft', ']', '['),
];

/**
 * DEL is the machine's delete-character key rather than a destructive
 * backspace - the Monitor sends 0x08 for that, from the `←` key - but the
 * editor wants the ordinary thing from a `⌫` legend, so its editor action
 * overrides the layer default.
 */
const delKey: KeyDef = {
  id: 'Del',
  spanX: 4,
  emits: ['Del'],
  labels: [{ text: '⌫', editor: { action: 'backspace' } }, null],
};

const enterKey: KeyDef = {
  id: 'Enter',
  spanX: 4,
  emits: ['Enter'],
  labels: [{ text: '↵', editor: { action: 'newline' } }, null],
};

const yxcvRow: KeyDef[] = [
  key('KeyZ', 'Y', 'y'),
  key('KeyX', 'X', 'x'),
  key('KeyC', 'C', 'c'),
  key('KeyV', 'V', 'v'),
  key('KeyB', 'B', 'b'),
  key('KeyN', 'N', 'n'),
  key('KeyM', 'M', 'm'),
  key('Comma', ',', '<'),
  key('Period', '.', '>'),
  key('Slash', '/', '?'),
  delKey,
  enterKey,
];

const shiftKey: KeyDef = {
  id: 'Shift',
  spanX: 6,
  emits: ['Shift'],
  modifier: 'shift',
  style: 'shift',
  labels: [{ text: '⇧' }, null],
};

/**
 * STOP breaks a running program. It is wired across the whole matrix the way
 * SHIFT is, but it selects no second legend set - the Monitor's code table has
 * shifted and unshifted lines and nothing else - so it is an ordinary key here
 * rather than a modifier.
 */
const stopKey: KeyDef = {
  id: 'Stop',
  spanX: 6,
  emits: ['Stop'],
  style: 'shift',
  labels: [{ text: 'STOP', editor: null }, null],
};

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: '␣', editor: { insert: ' ' } }, null],
} satisfies Omit<KeyDef, 'spanX'>;

/** A cursor key: it moves the caret in the editor and the machine's own cursor. */
function cursorKey(
  token: string,
  text: string,
  action: 'left' | 'right' | 'up',
): KeyDef {
  return {
    id: token,
    spanX: 4,
    emits: [token],
    labels: [{ text, editor: { action } }, null],
  };
}

/** The two tab keys, which the editor has no equivalent of. */
function tabKey(token: string, text: string): KeyDef {
  return {
    id: token,
    spanX: 4,
    emits: [token],
    labels: [{ text, editor: null }, null],
  };
}

const rows: KeyDef[][] = [
  numberRow,
  qwertzRow,
  homeRow,
  yxcvRow,
  bottomRow(
    [shiftKey, stopKey],
    spaceKey,
    [
      cursorKey('ArrowLeft', '←', 'left'),
      cursorKey('ArrowUp', '↑', 'up'),
      cursorKey('ArrowRight', '→', 'right'),
      tabKey('TabLeft', '|←'),
      tabKey('TabRight', '→|'),
    ],
    GRID_COLUMNS,
  ),
];

/**
 * The machine's top row: twelve function keys and the three editing keys that
 * share their band. K0-K11 are real keys with codes of their own rather than
 * macros - BASIC-G's `INKEY` reports which of them is held - and WRK selects
 * their second bank.
 */
const functionKeys: KeyDef[] = [
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `K${i}`,
    spanX: 4,
    emits: [`K${i}`],
    style: 'fn',
    labels: [{ text: `K${i}`, editor: null }, null],
  })),
  {
    id: 'WRK',
    spanX: 4,
    emits: ['WRK'],
    labels: [{ text: 'WRK', editor: null }, null],
  },
  {
    id: 'ClrDel',
    spanX: 4,
    emits: ['ClrDel'],
    labels: [{ text: 'C-D', editor: null }, null],
  },
  {
    id: 'Clr',
    spanX: 4,
    emits: ['Clr'],
    labels: [{ text: 'CLR', editor: null }, null],
  },
];

export const pmd85KeyboardLayout: KeyboardLayout = {
  id: 'pmd85',
  name: 'PMD 85-2',
  theme: 'vk-theme-pmd85',
  gridColumns: GRID_COLUMNS,
  layers: [
    {
      id: 'base',
      position: 'center',
      activeWhen: [],
      editorInsertStyle: 'char',
    },
    {
      id: 'shift',
      name: 'SHIFT',
      position: 'tr',
      activeWhen: ['shift'],
      editorInsertStyle: 'char',
    },
  ],
  modifiers: [{ id: 'shift', emits: ['Shift'], sticky: true, lockable: true }],
  rows,
  functionKeys,
  glyphs: {},
  // One frame is enough: the Monitor rescans the whole matrix many times over
  // a 2.048 MHz frame, so a tap that survives a single `runFrame` is seen.
  options: { minHoldFrames: 1 },
  /**
   * The on-screen controller drives the function keys, not WASD.
   *
   * `INKEY` is the machine's only key-at-a-time read and it sees nothing but
   * K0-K11 - so a controller bound to the letter keys would press keys no
   * real-time program on this machine can notice. The bundled games read
   * K0-K3, which is what these four bind to.
   */
  controller: {
    bindings: {
      up: 'K0',
      left: 'K1',
      right: 'K2',
      down: 'K3',
      fire1: 'K4',
    },
    labels: { up: 'K0', left: 'K1', right: 'K2', down: 'K3', fire1: 'K4' },
  },
};
