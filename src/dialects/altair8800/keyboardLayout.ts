// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeyDef, KeyboardLayout } from '../../keyboard/layoutSchema';
import { act, ins, key as kitKey } from '../../keyboard/legendKit';
import { bottomRow } from '../../keyboard/templateRows';

/**
 * The on-screen keyboard for the Altair - which, strictly, the Altair did not
 * have. The machine's own front panel is toggle switches and LEDs; you typed at
 * a Teletype ASR-33 wired to the serial board, so that is the keyboard modelled
 * here, arranged on the project's standard five-band template.
 *
 * Consequences for the layout data, all of them simplifications:
 *
 * - **Two layers, base and SHIFT.** No keyword layer (Altair BASIC is typed out
 *   in full, unlike Sinclair's one-key entry) and no graphics layer.
 * - **No `graphicsPalette`, and no `palette: 'graphics'` editor mode.** The
 *   machine has no block graphics, so this dialect must *not* be added to
 *   `e2e/paletteMachines.ts` - `src/dialects/graphicsPalette.test.ts` asserts
 *   that list matches exactly the dialects that have a palette.
 * - **Upper case only.** The ASR-33 had no lower case at all, which matches 8K
 *   BASIC's own uppercase-only parser.
 * - **CTRL matters.** The teletype's CTRL key produced the control codes BASIC
 *   depends on - above all CTRL-C to break a running program - so it is a real
 *   modifier here rather than decoration.
 *
 * **The SHIFT legends are not decoration either.** `emulator/keyboard.ts` sends
 * the byte the teletype's code bars would have sent, which is the unshifted
 * character with bit 4 flipped - so SHIFT-K really is `[`, SHIFT-P really is
 * `@`, and SHIFT-0 really is a space. Every shifted legend below is that byte,
 * and `keyboardLayout.test.ts` checks each one against `tokenToByte` rather than
 * trusting this file: a legend that disagreed would type one character into the
 * editor and send a different one to the machine.
 *
 * The keys carrying no second marking on a real ASR-33 - A-J, Q-Z and the space
 * bar - have no SHIFT legend, because flipping their bit 4 would land on another
 * letter and the mechanism simply does not do it. They fall back to their base
 * legend on the SHIFT layer, which is exactly what the machine does.
 *
 * Row order follows the teletype: digits, QWERTY, a home row ending in `;`, and
 * the punctuation row. `:` and `-` sat at the end of the teletype's own digit
 * band; here they move to the bottom row so every typing row keeps the project's
 * ten-key grid. The teletype's function keys - LINE FEED, RUB OUT and ALT MODE -
 * sit in the top strip rather than taking keycaps from the typing rows.
 */

/** A printing key: one machine token, a base legend and an optional SHIFT one. */
const key = (token: string, main: string, shift?: string): KeyDef =>
  kitKey(token, [main, shift ?? null]);

// SHIFT flips bit 4, so the shifted digits are the ASCII row 0x21-0x29 - and
// SHIFT-0 (0x30 ^ 0x10) is a space, which is why the tenth key carries a `␣`
// legend that inserts one.
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
  kitKey('Digit0', ['0', ins('␣', ' ')]),
];

// Only K-P carry a second marking: those are the six letters whose bit-4 flip
// lands outside A-Z, on `[ \ ] ^ _ @`.
const qwertyRow: KeyDef[] = [
  key('KeyQ', 'Q'),
  key('KeyW', 'W'),
  key('KeyE', 'E'),
  key('KeyR', 'R'),
  key('KeyT', 'T'),
  key('KeyY', 'Y'),
  key('KeyU', 'U'),
  key('KeyI', 'I'),
  key('KeyO', 'O', '_'),
  key('KeyP', 'P', '@'),
];

const homeRow: KeyDef[] = [
  key('KeyA', 'A'),
  key('KeyS', 'S'),
  key('KeyD', 'D'),
  key('KeyF', 'F'),
  key('KeyG', 'G'),
  key('KeyH', 'H'),
  key('KeyJ', 'J'),
  key('KeyK', 'K', '['),
  key('KeyL', 'L', '\\'),
  key('Semicolon', ';', '+'),
];

const punctuationRow: KeyDef[] = [
  key('KeyZ', 'Z'),
  key('KeyX', 'X'),
  key('KeyC', 'C'),
  key('KeyV', 'V'),
  key('KeyB', 'B'),
  key('KeyN', 'N', '^'),
  key('KeyM', 'M', ']'),
  key('Comma', ',', '<'),
  key('Period', '.', '>'),
  key('Slash', '/', '?'),
];

const ctrlKey: KeyDef = {
  id: 'Control',
  spanX: 6,
  emits: ['Control'],
  modifier: 'ctrl',
  style: 'shift',
  labels: [{ text: 'CTRL' }, null],
};

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

const enterKey = kitKey('Enter', [act('↵', 'newline'), null]);

/**
 * Not an ASR-33 key: a host keyboard's Backspace, which the machine adapter
 * maps to the underline BASIC's own line editor reads as "rub out the last
 * character typed". In the editor it does the obvious thing instead.
 */
const backspaceKey = kitKey('Backspace', [act('⌫', 'backspace'), null]);

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  punctuationRow,
  bottomRow([ctrlKey, shiftKey], spaceKey, [
    key('Colon', ':', '*'),
    key('Minus', '-', '='),
    enterKey,
    backspaceKey,
  ]),
];

/** A top-strip key: matrix token only, `editor: null` so it types nothing. */
const fnKey = (id: string, text: string): KeyDef => ({
  id,
  spanX: 4,
  emits: [id],
  style: 'fn',
  labels: [{ text, editor: null }, null],
});

/**
 * The teletype's own function keys, in the top strip. Each sends a fixed control
 * code whatever the modifiers are, and none of them types anything into the
 * editor, which is why they are here rather than on the typing grid.
 */
const functionKeys: KeyDef[] = [
  fnKey('LineFeed', 'LF'),
  fnKey('Rubout', 'RUB'),
  fnKey('Escape', 'ALT'),
];

export const altair8800KeyboardLayout: KeyboardLayout = {
  id: 'altair8800',
  name: 'Altair 8800',
  theme: 'vk-theme-altair8800',
  gridColumns: 40,
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
  modifiers: [
    { id: 'shift', emits: ['Shift'], sticky: true, lockable: true },
    { id: 'ctrl', emits: ['Control'], sticky: true, lockable: false },
  ],
  rows,
  functionKeys,
  glyphs: {},
  options: { minHoldFrames: 1 },
};
