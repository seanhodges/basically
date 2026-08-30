// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeyDef, KeyboardLayout } from '../../keyboard/layoutSchema';
import { act, key as kitKey } from '../../keyboard/legendKit';
import {
  type SymbolTable,
  bottomRow,
  centerRow,
  flankedRow,
  withSymbolMode,
} from '../../keyboard/templateRows';

/**
 * The Apple II's keyboard, shared with the Apple II Plus - the same board in
 * both, because the two machines differ only in which BASIC is in the ROM
 * sockets.
 *
 * Unlike the Apple I's, this keyboard came with the machine: an encoder
 * resolves SHIFT and CTRL itself and presents seven bits of ASCII at `$C000`,
 * and `emulator/apple2/keyboard.ts` is the other half of the vocabulary the
 * rows below emit.
 *
 * Consequences for the layout data:
 *
 * - **Two layers, base and SHIFT.** Integer BASIC is typed out in full - `?`
 *   for `PRINT` is the only abbreviation and it is a symbol, not a keyword
 *   layer - and the character generator draws no pictures, so there is no
 *   graphics layer and no `graphicsPalette`. This dialect must *not* be added
 *   to `e2e/paletteMachines.ts`: colour here comes from `COLOR=` and the lo-res
 *   page, not from characters.
 * - **Upper case only.** The 2513 has 64 glyphs and no lower case, the encoder
 *   sends `$20`-`$5F` and nothing else, and the interpreter refuses
 *   `10 print a`. So no `powerOnCase` either - there is only one case to be in.
 * - **CTRL matters.** It clears bits 6 and 5 in the encoder, and CTRL-C is how
 *   a running program is stopped.
 * - **The arrows are keys of their own**, not shifted anything: left sends
 *   `$08`, which the interpreter's line editor reads as a rub-out, so it is the
 *   delete flank; right sends `$15` and re-types the character under the
 *   cursor, so it is a caret move in the editor.
 *
 * The key faces below are the machine's own: the digits carry `!` to `)`, and
 * `P`, `K`, `L`, `M` and `N` carry `@`, `[`, `\`, `]` and `^`. The keys the
 * template has no slot for - `: ; , - . /` and their shifted `* + < = > ?` -
 * are reached through the SYM pages, and every SYM cell is checked against
 * `tokenToByte` by `keyboardLayout.test.ts`.
 */

/** A printing key: one machine token, its base legend, and its shifted one. */
const key = (token: string, main: string, shifted?: string): KeyDef =>
  kitKey(token, [main, shifted ?? null]);

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
  // The only digit with nothing on its shift: the encoder sends `0` either way.
  key('Digit0', '0'),
];

const qwertyRow: KeyDef[] = [
  key('KeyQ', 'Q'),
  key('KeyW', 'W'),
  key('KeyE', 'E'),
  key('KeyR', 'R'),
  key('KeyT', 'T'),
  key('KeyY', 'Y'),
  key('KeyU', 'U'),
  key('KeyI', 'I'),
  key('KeyO', 'O'),
  key('KeyP', 'P', '@'),
];

const homeRow: KeyDef[] = centerRow([
  key('KeyA', 'A'),
  key('KeyS', 'S'),
  key('KeyD', 'D'),
  key('KeyF', 'F'),
  key('KeyG', 'G'),
  key('KeyH', 'H'),
  key('KeyJ', 'J'),
  key('KeyK', 'K', '['),
  key('KeyL', 'L', '\\'),
]);

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

/**
 * Auto-repeat, and the one key here whose effect is to be held: alongside
 * another key it re-sends that key's character several times a second, which is
 * how a listing is scrolled and a row of dashes drawn. A lockable modifier is
 * what that is - tapped it repeats nothing, locked it repeats - rather than a
 * key that sends a character of its own.
 */
const repeatKey: KeyDef = {
  id: 'Rept',
  spanX: 6,
  emits: ['Rept'],
  modifier: 'rept',
  style: 'shift',
  labels: [{ text: 'REPT' }, null],
};

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: '␣', editor: { insert: ' ' } }, null],
} satisfies Omit<KeyDef, 'spanX'>;

const returnKey = kitKey('Enter', [act('↵', 'newline'), null], { spanX: 6 });

/**
 * The delete flank. This machine's backspace is the left arrow - `$08`, which
 * the interpreter's line editor reads as a rub-out - so the flank is that key
 * under its own legend rather than a `Backspace` the board never had. A host
 * Backspace reaches the same code through `emulator/apple2/keyboard.ts`.
 */
const leftArrowKey = kitKey('ArrowLeft', [act('←', 'backspace'), null]);

/** The other arrow: `$15`, which re-types the character under the cursor. */
const rightArrowKey = kitKey('ArrowRight', [act('→', 'right'), null]);

const letterRow3: KeyDef[] = flankedRow(
  shiftKey,
  [
    key('KeyZ', 'Z'),
    key('KeyX', 'X'),
    key('KeyC', 'C'),
    key('KeyV', 'V'),
    key('KeyB', 'B'),
    key('KeyN', 'N', '^'),
    key('KeyM', 'M', ']'),
  ],
  leftArrowKey,
);

// SHIFT+2 on this keyboard, given its own bottom-row key as on every board here.
const quoteKey = kitKey('Quote', ['"', null], { emits: ['Shift', 'Digit2'] });

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  letterRow3,
  bottomRow([ctrlKey, repeatKey], spaceKey, [
    rightArrowKey,
    quoteKey,
    returnKey,
  ]),
];

/**
 * How this keyboard reaches each canonical SYM symbol - the six punctuation
 * keys the template has no slot for, plus the shifted faces above.
 *
 * `£` is absent because the encoder has no code for it, and `_` because this
 * keyboard has no key that sends `$5F` at all: the Apple I's `SHIFT`-`O` is not
 * a pair this board carries, which leaves `\` the only page-2 symbol. Every
 * pair is checked against `tokenToByte` by the layout test.
 */
const APPLE2_SYMBOLS: SymbolTable = {
  '+': { emits: ['Shift', 'Semicolon'] },
  '!': { emits: ['Shift', 'Digit1'] },
  '?': { emits: ['Shift', 'Slash'] },
  '=': { emits: ['Shift', 'Minus'] },
  '/': { emits: ['Slash'] },
  '<': { emits: ['Shift', 'Comma'] },
  '>': { emits: ['Shift', 'Period'] },
  '[': { emits: ['Shift', 'KeyK'] },
  ']': { emits: ['Shift', 'KeyM'] },
  '@': { emits: ['Shift', 'KeyP'] },
  '#': { emits: ['Shift', 'Digit3'] },
  $: { emits: ['Shift', 'Digit4'] },
  '%': { emits: ['Shift', 'Digit5'] },
  '^': { emits: ['Shift', 'KeyN'] },
  '&': { emits: ['Shift', 'Digit6'] },
  '*': { emits: ['Shift', 'Colon'] },
  '(': { emits: ['Shift', 'Digit8'] },
  ')': { emits: ['Shift', 'Digit9'] },
  '-': { emits: ['Minus'] },
  "'": { emits: ['Shift', 'Digit7'] },
  '"': { emits: ['Shift', 'Digit2'] },
  ':': { emits: ['Colon'] },
  ';': { emits: ['Semicolon'] },
  ',': { emits: ['Comma'] },
  '.': { emits: ['Period'] },
  '\\': { emits: ['Shift', 'KeyL'] },
};

/** A top-strip key: matrix token only, `editor: null` so it types nothing. */
const fnKey = (id: string, text: string): KeyDef => ({
  id,
  spanX: 4,
  emits: [id],
  style: 'fn',
  labels: [{ text, editor: null }, null],
});

/**
 * The strip holds the two keys that drive the machine but type nothing into the
 * editor, not function keys - this machine has none. RESET is wired to the
 * CPU's reset line and never reaches the keyboard latch at all; ESC sends
 * `$1B`, which the interpreter reads as "abandon this line" and the editor has
 * no use for.
 */
const functionKeys: KeyDef[] = [
  fnKey('Reset', 'RESET'),
  fnKey('Escape', 'ESC'),
];

export const apple2KeyboardLayout: KeyboardLayout = withSymbolMode(
  {
    id: 'apple2',
    name: 'Apple II',
    theme: 'vk-theme-apple2',
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
    editorModes: [{ id: 'abc', name: 'ABC', layer: 'base' }],
    modifiers: [
      { id: 'shift', emits: ['Shift'], sticky: true, lockable: true },
      { id: 'ctrl', emits: ['Control'], sticky: true, lockable: false },
      { id: 'rept', emits: ['Rept'], sticky: true, lockable: true },
    ],
    rows,
    functionKeys,
    glyphs: {},
    /**
     * W A S D and the space bar: this keyboard has no up or down arrow, so
     * there is no four-way cluster of the machine's own for the pad to follow.
     * `samples/breakout.bas` and `samples/maze.bas` read exactly these.
     */
    controller: {
      bindings: {
        up: 'KeyW',
        down: 'KeyS',
        left: 'KeyA',
        right: 'KeyD',
        fire1: 'Space',
        fire2: 'Enter',
      },
    },
    options: { minHoldFrames: 1 },
  },
  APPLE2_SYMBOLS,
);
