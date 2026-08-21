// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeyDef, KeyboardLayout } from '../../keyboard/layoutSchema';
import { GRID_COLUMNS, bottomRow } from '../../keyboard/templateRows';

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
 * The real keyboard is a flat 15x5 grid of identical keycaps: twelve columns of
 * alphanumerics and symbols, then a three-column editing block, with the
 * function keys along the top. Reproducing that width would put fifteen keys
 * across a band the template gives ten, which is narrower than a thumb, so this
 * follows the Altair's arrangement instead - the other machine here whose
 * keyboard is wider than the template:
 *
 *  - Every typing band keeps the template's **ten** keys. The home row ends in
 *    `;` and the fourth in `, . /`, exactly where a typist expects them.
 *  - The symbol columns that no longer fit - `_`, `:` and `\\` - move to the
 *    bottom row beside DEL and ENTER, the way the Altair's `:` and `-` do.
 *    Between them those three carry `=`, `+`, `*` and `^`, without which no
 *    BASIC-G program can be typed at all.
 *  - The function keys have the top strip to themselves, WRK included: it
 *    selects their second bank, so it belongs with them rather than on a
 *    typing band.
 *
 * What is left over is reached from the host keyboard instead of a keycap: the
 * editing block (INS, RCL, END, the cursor keys, both tab keys, C-D, CLR and
 * the numeric ENTER), STOP, and the three symbol keys BASIC-G has no use for
 * (`@`, `]`, `}`). `emulator/keyboard.ts` maps each to the `KeyboardEvent.code`
 * a browser sends, and the layout test checks that union rather than the layout
 * alone, so a key reachable by neither route fails.
 *
 * STOP has no keycap for a second reason: it stops a running program, which on
 * this IDE is what the toolbar's own stop control is for, and a STOP the width
 * of a SHIFT sitting under the space bar invited being pressed by accident.
 */

/** Base and SHIFT legends for one printing key, index-aligned with `layers`. */
function key(token: string, main: string, shift: string): KeyDef {
  return {
    id: token,
    spanX: 4,
    emits: [token],
    labels: [{ text: main }, { text: shift }],
  };
}

// The symbol pairings are the machine's rather than a PC's: `_`/`=`, `:`/`*`,
// `\`/`^`, `;`/`+`. Note the shifted digits stop at `0`/`-`: `+` and `*` are
// not up here, which is why the bottom row's symbol keys are not optional.
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
];

const shiftKey: KeyDef = {
  id: 'Shift',
  spanX: 6,
  emits: ['Shift'],
  modifier: 'shift',
  style: 'shift',
  labels: [{ text: '⇧' }, null],
};

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: '␣', editor: { insert: ' ' } }, null],
} satisfies Omit<KeyDef, 'spanX'>;

/**
 * The three symbol columns the typing bands could not keep, either side of the
 * space bar with DEL and ENTER. They are not decoration: `_` and `:` carry `=`
 * and `*` on SHIFT, so a board without them cannot assign a variable or
 * multiply, and `\\` carries `^`.
 *
 * `_` and `:` take the two places against the space bar because they are the
 * pair a program reaches for most, and the split three-and-three keeps the
 * space bar at twelve columns - narrower than a machine with fewer keys to
 * place, but wide enough to hit.
 */
const rows: KeyDef[][] = [
  numberRow,
  qwertzRow,
  homeRow,
  yxcvRow,
  bottomRow(
    [shiftKey, key('Backslash', '\\', '^'), key('Underscore', '_', '=')],
    spaceKey,
    [key('Colon', ':', '*'), delKey, enterKey],
  ),
];

/**
 * The top strip: the twelve function keys and WRK, which selects their second
 * bank. K0-K11 are real keys with codes of their own rather than macros -
 * BASIC-G's `INKEY` reports which of them is held - and nothing a host keyboard
 * sends produces them, so the strip is their only route in.
 *
 * The other two keys of the machine's own top row, C-D and CLR, are editing
 * keys rather than function keys and are typed on the host (Home and PageUp).
 * Thirteen keys already run past the row's worth the board is wide, so the
 * strip scrolls to reach the last of them - every key here stays a keycap, and
 * every key added is one more the user has to scroll for.
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
    style: 'fn',
    labels: [{ text: 'WRK', editor: null }, null],
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
  /**
   * One frame is enough to be seen: the Monitor rescans the whole matrix many
   * times over a 2.048 MHz frame, so a tap that survives a single `runFrame`
   * lands.
   *
   * Twenty frames is as long as one may last. Hold a key on this machine and
   * the Monitor sends the character again 38 frames later, then one every four
   * - about thirteen a second - which a finger resting on glass reaches without
   * meaning to. Ending the press after 20 frames leaves that delay 18 frames
   * away, and costs the keyboard nothing this machine can read: `INKEY` sees
   * only K0-K11, and those are function keys, which stay held.
   */
  options: { minHoldFrames: 1, maxHoldFrames: 20 },
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
