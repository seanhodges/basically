// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeyDef, KeyboardLayout } from '../../keyboard/layoutSchema';
import {
  act,
  cursorKey,
  key as kitKey,
  withLegend,
} from '../../keyboard/legendKit';
import {
  GRID_COLUMNS,
  type SymbolTable,
  bottomRow,
  centerRow,
  flankedRow,
  withSymbolMode,
} from '../../keyboard/templateRows';

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
 * across a band the template gives ten, which is narrower than a thumb, so the
 * board is the standard template - centred nine-letter home row, the
 * SHIFT/DEL-flanked bottom letter row, ENTER at the bottom right - and the
 * symbol keys that no longer fit (`; _ : \\ , . /` and their SHIFT pairs
 * `+ = * ^ < > ?`) live in the SYM mode at the template's canonical
 * positions, each cell pressing the machine's own key or SHIFT pair. The
 * function keys have the top strip to themselves, WRK included: it selects
 * their second bank, so it belongs with them rather than on a typing band.
 *
 * The editing block's three cursor keys are the CURSOR mode's ← ↑ → overlay on
 * the A/W/D keys; there is no fourth, so S keeps only its letter.
 *
 * What is left over is reached from the host keyboard instead of a keycap: the
 * rest of the editing block (INS, RCL, END, both tab keys, C-D, CLR and the
 * numeric ENTER), STOP, and the three symbol keys BASIC-G has no use for
 * (`@`, `]`, `}`). `emulator/keyboard.ts` maps each to the `KeyboardEvent.code`
 * a browser sends, and the layout test checks that union rather than the layout
 * alone, so a key reachable by neither route fails.
 *
 * STOP has no keycap for a second reason: it stops a running program, which on
 * this IDE is what the toolbar's own stop control is for, and a STOP the width
 * of a SHIFT sitting under the space bar invited being pressed by accident.
 */

/** Index of the CURSOR layer in `layers` below. */
const CURSOR_LAYER = 2;

/** Base and SHIFT legends for one printing key, index-aligned with `layers`. */
const key = (token: string, main: string, shift: string): KeyDef =>
  kitKey(token, [main, shift]);

/**
 * A key that also carries a CURSOR-layer arrow. The PMD 85's editing block has
 * three cursor keys and no fourth: the Monitor's key-code table gives the cell
 * below `|<-` no code at all, and the two beside it are halves of the wide
 * ENTER. So S carries no arrow, and the overlay is ← ↑ → only.
 */
const withCursor = (
  def: KeyDef,
  arrow: string,
  action: 'left' | 'right' | 'up',
  token: string,
): KeyDef => withLegend(def, CURSOR_LAYER, cursorKey(arrow, action, token));

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
  withCursor(key('KeyW', 'W', 'w'), '↑', 'up', 'ArrowUp'),
  key('KeyE', 'E', 'e'),
  key('KeyR', 'R', 'r'),
  key('KeyT', 'T', 't'),
  key('KeyY', 'Z', 'z'),
  key('KeyU', 'U', 'u'),
  key('KeyI', 'I', 'i'),
  key('KeyO', 'O', 'o'),
  key('KeyP', 'P', 'p'),
];

const homeRow: KeyDef[] = centerRow([
  withCursor(key('KeyA', 'A', 'a'), '←', 'left', 'ArrowLeft'),
  key('KeyS', 'S', 's'),
  withCursor(key('KeyD', 'D', 'd'), '→', 'right', 'ArrowRight'),
  key('KeyF', 'F', 'f'),
  key('KeyG', 'G', 'g'),
  key('KeyH', 'H', 'h'),
  key('KeyJ', 'J', 'j'),
  key('KeyK', 'K', 'k'),
  key('KeyL', 'L', 'l'),
]);

/**
 * DEL takes the character the cursor is on. The machine has no backspace key at
 * all: the Monitor sends 0x08 for that, from the `←` key, which is CURSOR mode's
 * left arrow. So this keycap carries the machine's own legend and deletes
 * forwards on both surfaces - move the cursor back, then delete.
 */
const delKey: KeyDef = {
  ...kitKey('Del', [act('DEL', 'delete'), null]),
  spanX: 6,
};

const enterKey = kitKey('Enter', [act('↵', 'newline'), null], { spanX: 6 });

const shiftKey: KeyDef = {
  id: 'Shift',
  spanX: 6,
  emits: ['Shift'],
  modifier: 'shift',
  style: 'shift',
  labels: [{ text: '⇧' }, null],
};

const yxcvRow: KeyDef[] = flankedRow(
  shiftKey,
  [
    key('KeyZ', 'Y', 'y'),
    key('KeyX', 'X', 'x'),
    key('KeyC', 'C', 'c'),
    key('KeyV', 'V', 'v'),
    key('KeyB', 'B', 'b'),
    key('KeyN', 'N', 'n'),
    key('KeyM', 'M', 'm'),
  ],
  delKey,
);

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: '␣', editor: { insert: ' ' } }, null],
} satisfies Omit<KeyDef, 'spanX'>;

// The quote is SHIFT+2 on the machine, given its own bottom-row key as on
// every board (BASIC-G strings need it constantly).
const quoteKey = kitKey('Quote', ['"', null], { emits: ['Shift', 'Digit2'] });

const rows: KeyDef[][] = [
  numberRow,
  qwertzRow,
  homeRow,
  yxcvRow,
  bottomRow([], spaceKey, [quoteKey, enterKey]),
];

/**
 * How the PMD 85 reaches each canonical SYM symbol: the Monitor's own
 * pairings (`;+`, `_=`, `:*`, `\^`, `,<`, `.>`, `/?`, and `-` on SHIFT+0 -
 * the shifted digits stop at `0`/`-`, so `+ = *` live on the symbol keys),
 * every one crosschecked against the ROM key-code table by the layout test
 * and typed on the booted machine by the SYM battery.
 */
const PMD85_SYMBOLS: SymbolTable = {
  '+': { emits: ['Shift', 'Semicolon'] },
  '!': { emits: ['Shift', 'Digit1'] },
  '-': { emits: ['Shift', 'Digit0'] },
  '=': { emits: ['Shift', 'Underscore'] },
  '/': { emits: ['Slash'] },
  _: { emits: ['Underscore'] },
  '<': { emits: ['Shift', 'Comma'] },
  '>': { emits: ['Shift', 'Period'] },
  '#': { emits: ['Shift', 'Digit3'] },
  $: { emits: ['Shift', 'Digit4'] },
  '%': { emits: ['Shift', 'Digit5'] },
  '^': { emits: ['Shift', 'Backslash'] },
  '&': { emits: ['Shift', 'Digit6'] },
  '*': { emits: ['Shift', 'Colon'] },
  '(': { emits: ['Shift', 'Digit8'] },
  ')': { emits: ['Shift', 'Digit9'] },
  "'": { emits: ['Shift', 'Digit7'] },
  '"': { emits: ['Shift', 'Digit2'] },
  ':': { emits: ['Colon'] },
  ';': { emits: ['Semicolon'] },
  ',': { emits: ['Comma'] },
  '.': { emits: ['Period'] },
  '?': { emits: ['Shift', 'Slash'] },
  '\\': { emits: ['Backslash'] },
};

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

export const pmd85KeyboardLayout: KeyboardLayout = withSymbolMode(
  {
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
      {
        id: 'cursor',
        name: 'CURSOR',
        position: 'br',
        activeWhen: [],
      },
    ],
    editorModes: [
      { id: 'abc', name: 'ABC', layer: 'base' },
      { id: 'cursor', name: 'CURSOR', layer: 'cursor' },
    ],
    modifiers: [
      { id: 'shift', emits: ['Shift'], sticky: true, lockable: true },
    ],
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
  },
  PMD85_SYMBOLS,
);
