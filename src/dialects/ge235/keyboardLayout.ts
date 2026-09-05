// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeyDef, KeyboardLayout } from '../../keyboard/layoutSchema';
import { act, key as kitKey } from '../../keyboard/legendKit';
import {
  FLANK_SPAN,
  GRID_COLUMNS,
  type SymbolTable,
  bottomRow,
  centerRow,
  flankedRow,
  withSymbolMode,
} from '../../keyboard/templateRows';

/**
 * A Teletype Model 33 ASR, the terminal DTSS users actually sat at - and the
 * machine's only input device, since a GE-235 in the basement had no keyboard
 * of its own. The Altair's layout models the same teletype and is the
 * reference.
 *
 * What that costs the layout, all of it simplification:
 *
 * - **Two layers, base and SHIFT.** No keyword layer (Dartmouth BASIC is typed
 *   out in full) and no graphics layer, so no `graphicsPalette` and no place in
 *   `e2e/paletteMachines.ts`.
 * - **Upper case only.** The ASR-33 has one alphabet, which is also why the
 *   machine's 6-bit set has one.
 * - **No cursor cluster**, so no CURSOR mode: a carriage on a paper roll goes
 *   forward, and the only key that takes anything back is RUB OUT.
 * - **No CTRL.** The Altair keeps it because 8K BASIC breaks a program on
 *   CTRL-C; nothing on this machine reads a control code, so a CTRL keycap
 *   here would press nothing.
 *
 * **SHIFT is a bit-4 flip**, which is what makes the SYM pages more than
 * decoration: `interpreter/keyboard.ts` queues the character the teletype's
 * code bars would have sent, so SHIFT-K really is `[`, SHIFT-N really is the
 * `↑` this BASIC raises to a power with, and SHIFT-4 really is `$`. Those pairs
 * are the SYM table's rather than keycap legends - the keycaps carry the letter
 * alone - and `keyboardLayout.test.ts` checks every cell against `tokenToChar`.
 * The SHIFT keycap itself is the machine's own key, which is why it is here
 * with no legends of its own to show.
 *
 * The board is the standard template: digits, QWERTY, a centred nine-letter
 * home row, the letter row flanked by SHIFT and RUB OUT, and space, quote and
 * ENTER along the bottom.
 */

/** A printing key: one machine token and its keycap letter. */
const key = (token: string, main: string): KeyDef => kitKey(token, [main]);

const numberRow: KeyDef[] = [...'1234567890'].map((d) => key(`Digit${d}`, d));

const qwertyRow: KeyDef[] = [...'QWERTYUIOP'].map((c) => key(`Key${c}`, c));

const homeRow: KeyDef[] = centerRow(
  [...'ASDFGHJKL'].map((c) => key(`Key${c}`, c)),
);

const shiftKey: KeyDef = {
  id: 'Shift',
  spanX: FLANK_SPAN,
  emits: ['Shift'],
  modifier: 'shift',
  style: 'shift',
  labels: [{ text: '⇧' }, null],
};

/**
 * RUB OUT, the ASR-33's own key for taking back the character just typed - the
 * one the run-time's `INPUT` reads as a backspace. Named for the keycap rather
 * than for the host key that also reaches it.
 */
const ruboutKey: KeyDef = {
  ...kitKey('Rubout', [act('RUB', 'backspace'), null]),
  spanX: FLANK_SPAN,
};

const punctuationRow: KeyDef[] = flankedRow(
  shiftKey,
  [...'ZXCVBNM'].map((c) => key(`Key${c}`, c)),
  ruboutKey,
);

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: '␣', editor: { insert: ' ' } }, null],
} satisfies Omit<KeyDef, 'spanX'>;

// The quote is SHIFT-2 on the teletype; it takes a bottom-row key of its own,
// as it does on every board here.
const quoteKey = kitKey('Quote', ['"', null], { emits: ['Shift', 'Digit2'] });

const enterKey = kitKey('Enter', [act('↵', 'newline'), null], {
  spanX: FLANK_SPAN,
});

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  punctuationRow,
  bottomRow([], spaceKey, [quoteKey, enterKey]),
];

/**
 * How the teletype reaches each canonical SYM symbol, and which ones it cannot
 * reach at all.
 *
 * The routes are ASCII's own, because SHIFT flips bit 4: the shifted digits,
 * the `; : -` keys, and `[ \ ] ↑` on K L M N. What is missing is the point of
 * this machine - the 64-code BCD set has no `! # % & ' @ _ £`, and none of the
 * page-2 brackets or accents, so those slots stay blank rather than offering a
 * character the paper tape could not carry. `↑` sits in the `^` slot with its
 * own keycap glyph: the position is canonical, the character is the machine's,
 * and here it is an operator rather than a symbol.
 */
const GE235_SYMBOLS: SymbolTable = {
  '+': { emits: ['Shift', 'Semicolon'] },
  '?': { emits: ['Shift', 'Slash'] },
  '=': { emits: ['Shift', 'Minus'] },
  '/': { emits: ['Slash'] },
  '<': { emits: ['Shift', 'Comma'] },
  '>': { emits: ['Shift', 'Period'] },
  '[': { emits: ['Shift', 'KeyK'] },
  ']': { emits: ['Shift', 'KeyM'] },
  $: { emits: ['Shift', 'Digit4'] },
  '^': { emits: ['Shift', 'KeyN'], text: '↑', insert: '↑' },
  '*': { emits: ['Shift', 'Colon'] },
  '(': { emits: ['Shift', 'Digit8'] },
  ')': { emits: ['Shift', 'Digit9'] },
  '-': { emits: ['Minus'] },
  '"': { emits: ['Shift', 'Digit2'] },
  ':': { emits: ['Colon'] },
  ';': { emits: ['Semicolon'] },
  ',': { emits: ['Comma'] },
  '.': { emits: ['Period'] },
  '\\': { emits: ['Shift', 'KeyL'] },
};

export const ge235KeyboardLayout: KeyboardLayout = withSymbolMode(
  {
    id: 'ge235',
    name: 'Teletype Model 33 ASR',
    theme: 'vk-theme-ge235',
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
    editorModes: [{ id: 'abc', name: 'ABC', layer: 'base' }],
    modifiers: [
      { id: 'shift', emits: ['Shift'], sticky: true, lockable: true },
    ],
    rows,
    glyphs: {},
    options: { minHoldFrames: 1 },
  },
  GE235_SYMBOLS,
);
