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
 * A Teletype Model 33 ASR, which is what Appendix A shows a user sitting at -
 * "models 33 and 35" are the terminals it names, and the GE-635 itself is a
 * machine room away with nothing of its own to type on.
 *
 * The board is the same terminal the GE-235 offers, so the keycaps are the
 * same: upper case only, no keyword layer, no graphics layer, no cursor
 * cluster (a carriage on a paper roll goes forward, and RUB OUT takes back the
 * character just typed rather than moving to it) and no CTRL, nothing in this
 * run-time reading a control code.
 *
 * **What differs is what the far end of the wire can say.** SHIFT is a bit-4
 * flip on this terminal, so every key's shifted marking is the character 16
 * codes up - and where the GE-235's six-bit set had no code for `! # % & ' @`
 * and the back arrow, so dropped them, this machine's codes are ASCII (section
 * 2.7: "128 characters numbered 0 through 127") and has all of them. So the SYM
 * pages here are full: every character the Teletype can print is reachable,
 * which `keyboardLayout.test.ts` checks code by code against the charset.
 *
 * Two SYM cells show the machine's character in a canonical slot rather than
 * the slot's own, which is the arrangement `templateRows` allows for exactly
 * this: `↑` sits in the `^` slot, where it is this BASIC's exponent operator
 * rather than punctuation, and `←` sits in the `_` slot. They are the pair the
 * ASR-33 prints at codes 94 and 95, and the positions are where a reader looks.
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
 * How the teletype reaches each canonical SYM symbol.
 *
 * Every route is ASCII's own, because SHIFT flips bit 4: the whole shifted
 * digit row `! " # $ % & ' ( )`, the `; : - , . /` keys, and `@ [ \ ] ↑ ←` on
 * P K L M N O. The only page-1 slot left blank is `£`, which is not an ASCII
 * character and so is not one this machine's tape could carry; page 2's
 * backquote, tilde, bar and braces are all above code 95 and are blank for the
 * same reason.
 */
const GE635_SYMBOLS: SymbolTable = {
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
  '^': { emits: ['Shift', 'KeyN'], text: '↑', insert: '↑' },
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
  _: { emits: ['Shift', 'KeyO'], text: '←', insert: '←' },
};

export const ge635KeyboardLayout: KeyboardLayout = withSymbolMode(
  {
    id: 'ge635',
    name: 'Teletype Model 33 ASR',
    theme: 'vk-theme-ge635',
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
  GE635_SYMBOLS,
);
