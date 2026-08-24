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
 * The Apple I's keyboard - which the Apple I did not come with. The board
 * carries a connector expecting a fully encoded ASCII keyboard the owner
 * supplied, usually a surplus Datanetics or Cherry unit, so what is modelled
 * here is that keyboard: the key faces the ASCII boards of the period shared,
 * arranged on the project's standard five-band template.
 *
 * Consequences for the layout data:
 *
 * - **Two layers, base and SHIFT.** Integer BASIC is typed out in full - there
 *   is no abbreviation of any kind on this machine, not even `?` for PRINT - so
 *   there is no keyword layer, and there are no graphics characters, so there is
 *   no graphics layer and no `graphicsPalette`. This dialect must *not* be added
 *   to `e2e/paletteMachines.ts`.
 * - **Upper case only.** The Signetics 2513 has 64 glyphs and no lower case, and
 *   the interpreter refuses `10 print a` outright.
 * - **CTRL matters.** It clears bits 5 and 6 in the keyboard's own encoder, and
 *   CTRL-C is the only way to break a running program.
 *
 * **`O` carries `_`, and that is the backspace.** Both the monitor and Integer
 * BASIC read the underline as "rub out the last character typed"; the machine
 * has no other. The layout's own delete key sends `Backspace`, which
 * `emulator/keyboard.ts` maps to that same underline, so the flank does the
 * expected thing without pretending to be a key the board had.
 *
 * The SHIFT pairs below are key-face facts rather than legends: the keycaps
 * carry the letter alone and symbols are the SYM mode's work, with every SYM
 * cell checked against `tokenToByte` by `keyboardLayout.test.ts`.
 */

/** A printing key: one machine token and its base legend. */
const key = (token: string, main: string): KeyDef =>
  kitKey(token, [main, null]);

const numberRow: KeyDef[] = [
  key('Digit1', '1'),
  key('Digit2', '2'),
  key('Digit3', '3'),
  key('Digit4', '4'),
  key('Digit5', '5'),
  key('Digit6', '6'),
  key('Digit7', '7'),
  key('Digit8', '8'),
  key('Digit9', '9'),
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
  key('KeyP', 'P'),
];

const homeRow: KeyDef[] = centerRow([
  key('KeyA', 'A'),
  key('KeyS', 'S'),
  key('KeyD', 'D'),
  key('KeyF', 'F'),
  key('KeyG', 'G'),
  key('KeyH', 'H'),
  key('KeyJ', 'J'),
  key('KeyK', 'K'),
  key('KeyL', 'L'),
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

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: '␣', editor: { insert: ' ' } }, null],
} satisfies Omit<KeyDef, 'spanX'>;

const returnKey = kitKey('Enter', [act('↵', 'newline'), null], { spanX: 6 });

/**
 * The delete flank. `Backspace` is not a token any 1976 ASCII keyboard sent;
 * the machine adapter maps it to the underline the monitor and the interpreter
 * both read as a rub-out, which is the only one this machine has.
 */
const backspaceKey: KeyDef = {
  ...kitKey('Backspace', [act('⌫', 'backspace'), null]),
  spanX: 6,
};

const letterRow3: KeyDef[] = flankedRow(
  shiftKey,
  [
    key('KeyZ', 'Z'),
    key('KeyX', 'X'),
    key('KeyC', 'C'),
    key('KeyV', 'V'),
    key('KeyB', 'B'),
    key('KeyN', 'N'),
    key('KeyM', 'M'),
  ],
  backspaceKey,
);

// The quote is SHIFT+2 on an ASCII keyboard of this vintage, given its own
// bottom-row key as on every board here.
const quoteKey = kitKey('Quote', ['"', null], { emits: ['Shift', 'Digit2'] });

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  letterRow3,
  bottomRow([ctrlKey], spaceKey, [quoteKey, returnKey]),
];

/**
 * How this keyboard reaches each canonical SYM symbol. The digits carry `!` to
 * `)`, the four punctuation keys carry the comparison and arithmetic symbols
 * BASIC needs, and six letters (K L M N O P) carry the remaining ASCII
 * punctuation `[ \ ] ^ _ @`. Every pair is checked against `tokenToByte` by the
 * layout test. `£` and the page-2 brace and bar characters are absent because
 * the encoder has no code for them: 64 printing characters is all there is.
 */
const APPLE1_SYMBOLS: SymbolTable = {
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
  _: { emits: ['Shift', 'KeyO'] },
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
 * The two buttons on the board, plus ESC. CLEAR SCREEN is wired to the video
 * logic and RESET to the CPU's reset line; neither reaches the keyboard port,
 * so neither sends a character and neither belongs on the typing grid. ESC
 * does send one - the monitor's "abandon this line" - but types nothing into
 * the editor, which is why it sits here too.
 */
const functionKeys: KeyDef[] = [
  fnKey('ClearScreen', 'CLR'),
  fnKey('Reset', 'RESET'),
  fnKey('Escape', 'ESC'),
];

export const apple1KeyboardLayout: KeyboardLayout = withSymbolMode(
  {
    id: 'apple1',
    name: 'Apple I',
    theme: 'vk-theme-apple1',
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
    ],
    rows,
    functionKeys,
    glyphs: {},
    options: { minHoldFrames: 1 },
  },
  APPLE1_SYMBOLS,
);
