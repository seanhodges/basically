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
  FLANK_SPAN,
  GRID_COLUMNS,
  KEY_SPAN,
  bottomRow,
  centerRow,
  flankedRow,
  withSymbolMode,
} from '../../keyboard/templateRows';
import { HB10P_GRAPH_GRAPHICS, HB10P_GRAPH_SHIFT_GRAPHICS } from './graphics';

/**
 * The HB-10P's international QWERTY keyboard.
 *
 * Geometry comes entirely from the shared template: a keycap here is the same
 * size as one on any other machine, and a board wider than the template moves
 * what does not fit to the bottom row rather than widening the grid. The MSX
 * board is one of the wider ones, so ESC, TAB, SELECT, HOME, INS and DEL have
 * no keycap of their own and are reached from the host keyboard instead
 * (`CODE_TO_TOKEN` in `src/emulator/msx/keyboard.ts` maps each); the numeric
 * keypad the standard defines is not fitted on this model at all.
 *
 * A letter key is a case pair. The machine powers up in lower case - typing an
 * unshifted `A` on the booted ROM echoes `a` - so the base legend is the small
 * letter, SHIFT gives the capital, and CAPS latches the other way round.
 *
 * The machine's shifted key faces, which the typing bands do not carry: the
 * number row is `)!@#$%^&*(` from `0`, and the punctuation keys are `-_`,
 * `=+`, `` \| ``, `[{`, `]}`, `;:`, `'"`, `£~`, `,<`, `.>` and `/?`. Every one
 * of them is reached through the SYM pages below at the template's canonical
 * positions rather than from a SHIFT layer.
 *
 * The MSX has a real four-way cursor cluster, so the CURSOR mode's `↑ ← ↓ →`
 * overlay on the W/A/S/D keys presses the machine's own `CursorUp`/… cells
 * rather than the letters. Those cells are also what the on-screen controller
 * binds to, which is why they appear again as `controllerKeys` the renderer
 * never draws: MSX BASIC reads exactly them through `STICK(0)`, and the space
 * bar through `STRIG(0)`, so a program driven by the pad is the same program
 * that reads the joystick port.
 */

/** The two character layers, index-aligned with `layers` below. */
type Legends = [Legend, Legend];

/**
 * A standard key: [base, shifted] legends plus an optional CURSOR-layer
 * legend (the ↑←↓→ overlay on the WASD keys), one matrix token.
 */
const key = (token: string, legends: Legends, cursor: Legend = null): KeyDef =>
  kitKey(token, [...legends, cursor]);

/** A letter key: lower case unshifted, the capital under SHIFT. */
const letter = (l: string, cursor: Legend = null): KeyDef =>
  key(l, [l.toLowerCase(), l], cursor);

const numberRow = Array.from({ length: 10 }, (_, i) =>
  key(`Digit${(i + 1) % 10}`, [`${(i + 1) % 10}`, null]),
);

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
  spanX: FLANK_SPAN,
  emits: ['Shift'],
  modifier: 'shift',
  style: 'shift',
  labels: [{ text: '⇧' }, null, null],
};

/** BS, the MSX's rub-out: it deletes to the left of the cursor. */
const backspaceKey: KeyDef = {
  id: 'Backspace',
  spanX: FLANK_SPAN,
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

/** A bottom-row key that presses the machine and leaves the editor alone. */
const machineKey = (id: string, label: string, modifier?: string): KeyDef => ({
  id,
  spanX: KEY_SPAN,
  emits: [id],
  ...(modifier ? { modifier } : {}),
  labels: [{ text: label, editor: null }, null, null],
});

/**
 * The three keys with no character of their own that a BASIC session needs at
 * hand: CTRL (whose pair with STOP is how a running program is broken), GRAPH
 * (the second character set, also offered as the palette below) and STOP.
 */
const ctrlKey = machineKey('Control', 'CTRL', 'ctrl');
const graphKey = machineKey('Graph', 'GRAPH', 'graph');
const stopKey = machineKey('Stop', 'STOP');

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: '␣', editor: { insert: ' ' } }, null, null],
} satisfies Omit<KeyDef, 'spanX'>;

/** Double quote, SHIFT over the apostrophe key on this board. */
const quoteKey: KeyDef = {
  id: 'Quote',
  spanX: KEY_SPAN,
  emits: ['Shift', 'Quote'],
  labels: [{ text: '"' }, null, null],
};

const returnKey: KeyDef = kitKey('Return', [act('↵', 'newline')], {
  spanX: FLANK_SPAN,
});

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRow([ctrlKey, graphKey, stopKey], spaceKey, [quoteKey, returnKey]),
];

/**
 * The function-key strip: F1-F5, and F6-F10 which the machine reaches by
 * holding SHIFT over the same five keys. Ten is the whole strip - the MSX
 * standard defines no eleventh - and each one presses the matrix and nothing
 * else, so the ROM's own soft-key strings arrive rather than the label.
 */
const functionKeys: KeyDef[] = Array.from({ length: 10 }, (_, i) => {
  const n = i + 1;
  const token = `F${n <= 5 ? n : n - 5}`;
  return {
    id: `Fn${n}`,
    spanX: KEY_SPAN,
    emits: n <= 5 ? [token] : ['Shift', token],
    style: 'fn',
    labels: [{ text: `f${n}`, editor: null }, null, null],
  };
});

/**
 * The cursor cluster: real keys on this machine, but shown as the CURSOR
 * overlay on W/A/S/D rather than as four more keycaps. They live here so the
 * on-screen controller can bind them without the renderer drawing them.
 */
const cursorControllerKey = (token: string, glyph: string): KeyDef => ({
  id: token,
  spanX: KEY_SPAN,
  emits: [token],
  style: 'cursor',
  labels: [{ text: glyph }, null, null],
});

const controllerKeys: KeyDef[] = [
  cursorControllerKey('CursorUp', '↑'),
  cursorControllerKey('CursorDown', '↓'),
  cursorControllerKey('CursorLeft', '←'),
  cursorControllerKey('CursorRight', '→'),
];

/**
 * How this board reaches each canonical SYM symbol, every pair taken from the
 * BIOS's own unshifted and shifted decoding tables (see `./graphics.ts` for
 * where they sit, and `keyboardLayout.test.ts` for the crosscheck).
 *
 * The one page-1 cell this machine leaves blank is the backquote: the
 * international MSX puts `£` on that key instead, and there is no other route
 * to 0x60.
 */
const MSX_SYMBOLS: SymbolTable = {
  '+': { emits: ['Shift', 'Equal'] },
  '!': { emits: ['Shift', 'Digit1'] },
  '?': { emits: ['Shift', 'Slash'] },
  '=': { emits: ['Equal'] },
  '/': { emits: ['Slash'] },
  '£': { emits: ['Pound'] },
  '<': { emits: ['Shift', 'Comma'] },
  '>': { emits: ['Shift', 'Period'] },
  '[': { emits: ['BracketOpen'] },
  ']': { emits: ['BracketClose'] },
  '@': { emits: ['Shift', 'Digit2'] },
  '#': { emits: ['Shift', 'Digit3'] },
  $: { emits: ['Shift', 'Digit4'] },
  '%': { emits: ['Shift', 'Digit5'] },
  '^': { emits: ['Shift', 'Digit6'] },
  '&': { emits: ['Shift', 'Digit7'] },
  '*': { emits: ['Shift', 'Digit8'] },
  '(': { emits: ['Shift', 'Digit9'] },
  ')': { emits: ['Shift', 'Digit0'] },
  '-': { emits: ['Minus'] },
  "'": { emits: ['Quote'] },
  '"': { emits: ['Shift', 'Quote'] },
  ':': { emits: ['Shift', 'Semicolon'] },
  ';': { emits: ['Semicolon'] },
  ',': { emits: ['Comma'] },
  '.': { emits: ['Period'] },
  '~': { emits: ['Shift', 'Pound'] },
  '\\': { emits: ['Backslash'] },
  '|': { emits: ['Shift', 'Backslash'] },
  '{': { emits: ['Shift', 'BracketOpen'] },
  '}': { emits: ['Shift', 'BracketClose'] },
  _: { emits: ['Shift', 'Minus'] },
};

export const hb10pKeyboardLayout: KeyboardLayout = withSymbolMode(
  {
    id: 'hb10p',
    name: 'Sony HB-10P',
    theme: 'vk-theme-hb10p',
    gridColumns: GRID_COLUMNS,
    // Lower case at power-on, read off the booted ROM, which is why the base
    // legends are the small letters.
    powerOnCase: 'lower',
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
      // The graphics are printed on the front faces of the keycaps, so the
      // palette labels each cell with its key and the GRAPH combination that
      // reaches it; the mode pins no layer, leaving GRAPH and SHIFT their
      // ordinary meanings while it is open.
      { id: 'graphics', name: 'GRAPHICS', layer: 'base', palette: 'graphics' },
    ],
    modifiers: [
      // CAPS, the machine's case lock, latched by locking the shift key: it
      // toggles, so the same keypress releases it.
      {
        id: 'shift',
        emits: ['Shift'],
        sticky: true,
        lockable: true,
        caseLock: { emits: ['CapsLock'] },
      },
      { id: 'ctrl', emits: ['Control'], sticky: true, lockable: true },
      { id: 'graph', emits: ['Graph'], sticky: true, lockable: true },
    ],
    rows,
    graphicsPalette: {
      sections: [
        { title: 'GRAPH', entries: HB10P_GRAPH_GRAPHICS },
        { title: 'GRAPH + SHIFT', entries: HB10P_GRAPH_SHIFT_GRAPHICS },
      ],
    },
    functionKeys,
    controllerKeys,
    glyphs: {},
    options: { minHoldFrames: 4 },
    // The cursor cluster and the space bar: what MSX BASIC's own STICK(0) and
    // STRIG(0) read, so the pad drives a program written for the joystick.
    controller: {
      bindings: {
        up: 'CursorUp',
        down: 'CursorDown',
        left: 'CursorLeft',
        right: 'CursorRight',
        fire1: 'Space',
        fire2: 'Return',
      },
    },
  },
  MSX_SYMBOLS,
);
