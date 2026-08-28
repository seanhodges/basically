// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeyDef, KeyboardLayout } from '../../keyboard/layoutSchema';
import {
  type Legend,
  act,
  cursorKey,
  key as kitKey,
} from '../../keyboard/legendKit';
import {
  type SymbolTable,
  bottomRow,
  centerRow,
  flankedRow,
  withSymbolMode,
} from '../../keyboard/templateRows';
import { ATARI_GRAPHICS } from './graphics';

/**
 * The Atari 400/800 keyboard on the standard virtual-keyboard template:
 * number row, ten-key QWERTY row, centred nine-key home row, the
 * SHIFT/BACK-S-flanked bottom letter row, and a bottom row of CTRL, CAPS,
 * space, quote and RETURN at the far right.
 *
 * One layout serves both machines. The 400's membrane keyboard has the same
 * keys in the same places as the 800's full-travel one, so the difference is a
 * theme rather than a geometry.
 *
 * A letter key carries the capital on both character layers, because SHIFT
 * gives upper case whichever way the machine's case lock is set - the same
 * arrangement the BBC has. The keycap follows the lock instead, and shows the
 * case it will type; `capsKey` below is the only way to the other one.
 *
 * The machine's punctuation lives in the SYM mode at the template's canonical
 * positions, each cell pressing the Atari's own key or SHIFT pair. Every pair
 * was read off the booted OS ROM (`keyboardLayout.test.ts`), which is where the
 * two that a modern keyboard would put elsewhere came from: `[` and `]` are
 * SHIFT over `,` and `.`, and `@` is SHIFT+8.
 *
 * The four cursor keys have no keycaps of their own - they are CTRL over `-`,
 * `=`, `+` and `*`, exactly as those keycaps say - so they are the CURSOR
 * mode's `↑ ← ↓ →` overlay on the W/A/S/D keys instead, as on the BBC and the
 * CPC. Each one emits the machine's cursor token, which folds the CTRL in.
 */

/** The two character layers, index-aligned with `layers` below. */
type Legends = [Legend, Legend];

/** A standard key: [base, shifted] legends, plus an optional CURSOR overlay. */
const key = (token: string, legends: Legends, cursor: Legend = null): KeyDef =>
  kitKey(token, [...legends, cursor]);

/** A letter key: the capital on both character layers (see the note above). */
const letter = (l: string, cursor: Legend = null): KeyDef =>
  key(l, [l, l], cursor);

const numberRow = [
  key('Num1', ['1', null]),
  key('Num2', ['2', null]),
  key('Num3', ['3', null]),
  key('Num4', ['4', null]),
  key('Num5', ['5', null]),
  key('Num6', ['6', null]),
  key('Num7', ['7', null]),
  key('Num8', ['8', null]),
  key('Num9', ['9', null]),
  key('Num0', ['0', null]),
];

const qwertyRow = [
  letter('Q'),
  letter('W', cursorKey('↑', 'up', 'CursorUp')),
  letter('E'),
  letter('R'),
  letter('T'),
  letter('Y'),
  letter('U'),
  letter('I'),
  letter('O'),
  letter('P'),
];

const homeRow = centerRow([
  letter('A', cursorKey('←', 'left', 'CursorLeft')),
  letter('S', cursorKey('↓', 'down', 'CursorDown')),
  letter('D', cursorKey('→', 'right', 'CursorRight')),
  letter('F'),
  letter('G'),
  letter('H'),
  letter('J'),
  letter('K'),
  letter('L'),
]);

const shiftKey: KeyDef = {
  id: 'Shift',
  spanX: 6,
  emits: ['Shift'],
  modifier: 'shift',
  style: 'shift',
  labels: [{ text: '⇧' }, null, null],
};

/** BACK S, the Atari's backspace: it deletes to the left, as the cap says. */
const backspaceKey: KeyDef = {
  id: 'Backspace',
  spanX: 6,
  emits: ['Backspace'],
  labels: [{ text: '⌫', editor: { action: 'backspace' } }, null, null],
};

const zxcvRow = flankedRow(
  shiftKey,
  [
    letter('Z'),
    letter('X'),
    letter('C'),
    letter('V'),
    letter('B'),
    letter('N'),
    letter('M'),
  ],
  backspaceKey,
);

/**
 * CTRL, which selects the graphics printed on the front of the keycaps and,
 * with `-` `=` `+` `*`, the cursor keys. A held modifier on this machine, not a
 * lock: POKEY reports it on its own line beside the key it is held with.
 */
const ctrlKey: KeyDef = {
  id: 'Ctrl',
  spanX: 6,
  emits: ['Ctrl'],
  modifier: 'ctrl',
  labels: [{ text: 'CTRL', editor: null }, null, null],
};

/**
 * CAPS/LOWR, the machine's case lock, beside the CTRL key it is pressed with.
 *
 * The Atari's route to lower case, and the reason this keycap is here: it
 * powers up caps-locked and its SHIFT gives upper case in either lock state, so
 * nothing else on the board reaches lower case. A tap, not a held modifier -
 * the lock lives in the OS's SHFLOK cell.
 *
 * The keycap is one-way on the real machine: alone it selects lower case, and
 * it is SHIFT+CAPS that locks the capitals back on. So the keycap presses that
 * pair while SHIFT is engaged, which is what a reader of the cap would do.
 */
const capsKey: KeyDef = {
  id: 'CapsLock',
  spanX: 6,
  emits: ['CapsLock'],
  caseLock: true,
  labels: [
    { text: 'CAPS', editor: null },
    { text: 'CAPS', editor: null, emits: ['Shift', 'CapsLock'] },
    null,
  ],
};

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: '␣', editor: { insert: ' ' } }, null, null],
} satisfies Omit<KeyDef, 'spanX'>;

const quoteKey: KeyDef = {
  id: 'Quote',
  spanX: 4,
  emits: ['Shift', 'Num2'],
  labels: [{ text: '"' }, null, null],
};

const returnKey: KeyDef = kitKey('Return', [act('↵', 'newline')], { spanX: 6 });

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRow([ctrlKey, capsKey], spaceKey, [quoteKey, returnKey]),
];

/**
 * The top strip: this machine's keys that type nothing.
 *
 * The Atari had no function keys, so the strip carries the keys that press the
 * machine and leave the editor alone. START, SELECT and OPTION are three lines
 * into GTIA that a program reads with `PEEK(53279)`, and BREAK is a line POKEY
 * watches - which is why it stops a program that is not reading the keyboard.
 * The other three are in the matrix but have no character to put on a typing
 * band: ESC arms the next control code, TAB moves to the next tab stop, and the
 * Atari logo key flips the inverse-video bit every following character is
 * stored with. SYSTEM RESET is left off - it is wired to the CPU's reset line
 * rather than to a key anything can read.
 */
const stripKey = (id: string, label: string): KeyDef => ({
  id,
  spanX: 4,
  emits: [id],
  style: 'fn',
  labels: [{ text: label, editor: null }, null, null],
});

const functionKeys: KeyDef[] = [
  stripKey('Escape', 'ESC'),
  stripKey('Tab', 'TAB'),
  stripKey('Atari', 'INV'),
  stripKey('Break', 'BREAK'),
  stripKey('Start', 'START'),
  stripKey('Select', 'SELECT'),
  stripKey('Option', 'OPTION'),
];

/**
 * How the Atari reaches each canonical SYM symbol, every pair read off the
 * booted OS ROM. The machine has dedicated keys for `, . / ; = - + * < >`, and
 * the rest are SHIFT pairs. Three symbols the pages carry have no Atari
 * character at all - `£` and the `` ` ~ { } `` group - so their cells stay
 * blank.
 */
const ATARI_SYMBOLS: SymbolTable = {
  '+': { emits: ['Plus'] },
  '!': { emits: ['Shift', 'Num1'] },
  '?': { emits: ['Shift', 'Slash'] },
  '=': { emits: ['Equal'] },
  '/': { emits: ['Slash'] },
  '<': { emits: ['Less'] },
  '>': { emits: ['Greater'] },
  '[': { emits: ['Shift', 'Comma'] },
  ']': { emits: ['Shift', 'Period'] },
  '@': { emits: ['Shift', 'Num8'] },
  '#': { emits: ['Shift', 'Num3'] },
  $: { emits: ['Shift', 'Num4'] },
  '%': { emits: ['Shift', 'Num5'] },
  '^': { emits: ['Shift', 'Asterisk'] },
  '&': { emits: ['Shift', 'Num6'] },
  '*': { emits: ['Asterisk'] },
  '(': { emits: ['Shift', 'Num9'] },
  ')': { emits: ['Shift', 'Num0'] },
  '-': { emits: ['Minus'] },
  "'": { emits: ['Shift', 'Num7'] },
  '"': { emits: ['Shift', 'Num2'] },
  ':': { emits: ['Shift', 'Semicolon'] },
  ';': { emits: ['Semicolon'] },
  ',': { emits: ['Comma'] },
  '.': { emits: ['Period'] },
  '\\': { emits: ['Shift', 'Plus'] },
  '|': { emits: ['Shift', 'Equal'] },
  _: { emits: ['Shift', 'Minus'] },
};

export const atariKeyboardLayout: KeyboardLayout = withSymbolMode(
  {
    id: 'atari',
    name: 'Atari 400/800',
    theme: 'vk-theme-atari',
    gridColumns: 40,
    // Caps-locked at power-on, so the base legends are the capitals - see
    // `capsKey` above.
    powerOnCase: 'upper',
    layers: [
      {
        id: 'base',
        position: 'center',
        activeWhen: [],
        editorInsertStyle: 'char',
      },
      {
        id: 'shifted',
        name: 'SHIFT',
        position: 'tl',
        activeWhen: ['shift'],
        editorInsertStyle: 'char',
      },
      {
        id: 'cursor',
        name: 'CURSOR',
        position: 'tr',
        activeWhen: [],
        modeOnly: true,
      },
    ],
    editorModes: [
      { id: 'abc', name: 'ABC', layer: 'base' },
      { id: 'cursor', name: 'CURSOR', layer: 'cursor' },
      // The graphics are printed on the keycaps, so the palette labels each
      // cell with the key it is on; the mode pins no layer, leaving CTRL and
      // SHIFT their ordinary meanings while it is open.
      { id: 'graphics', name: 'GRAPHICS', layer: 'base', palette: 'graphics' },
    ],
    modifiers: [
      { id: 'shift', emits: ['Shift'], sticky: true, lockable: true },
      { id: 'ctrl', emits: ['Ctrl'], sticky: true, lockable: true },
    ],
    rows,
    graphicsPalette: {
      sections: [{ title: 'CTRL graphics', entries: ATARI_GRAPHICS }],
    },
    functionKeys,
    glyphs: {},
    // The Atari's own joystick is the machine's game interface, so these are
    // for the keyboard-driven samples: the WASD cluster the CURSOR mode already
    // marks, with space and RETURN as the two fire buttons.
    controller: {
      bindings: {
        up: 'W',
        down: 'S',
        left: 'A',
        right: 'D',
        fire1: 'Space',
        fire2: 'Return',
      },
    },
  },
  ATARI_SYMBOLS,
);
