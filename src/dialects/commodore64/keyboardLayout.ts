import type { KeyDef, KeyboardLayout } from '../../keyboard/layoutSchema';
import {
  type CursorAction,
  type Legend,
  act,
  cursorKey,
  ins,
  key as kitKey,
  lbl,
  withLegend,
} from '../../keyboard/legendKit';
import { bottomRow } from '../../keyboard/templateRows';
import { C64_COMMODORE_GRAPHICS, C64_SHIFT_GRAPHICS } from './graphics';

/**
 * The Commodore 64 keyboard on the standard 10-wide virtual-keyboard template.
 *
 * Three top-strip modes let a single key carry an operator *and* its two block
 * graphics without clashing (the real machine prints both graphics on the key's
 * front face):
 *  - **ABC** - letters/digits; SHIFT gives the shifted symbols and the editor
 *    operators (`+ - * / = : ; @ £`, `! " # …`) that ride the SHIFT layer.
 *  - **SYM** - the six C64 graphics-key characters `+ - £ @ * ↑`, which have no
 *    dedicated key on the 10-wide grid, surfaced as editor inserts on the number
 *    row (keys 1-6). Editor-only, like the BBC's SYM overflow layer.
 *  - **GRAPHICS** - the sixty-odd block graphics as a palette in two sections
 *    (the C= set and the SHIFT set) rather than as key legends: they do not fit
 *    on the keycaps legibly, and the palette labels each one with the key and
 *    modifier that produces it on the real machine.
 *
 * The four physical function keys yield eight values (f2/f4/f6/f8 are SHIFT of
 * the odd keys); all eight are shown as separate keys in the top strip, behind
 * the strip's mode/function toggle. RUN/STOP and RESTORE are dropped.
 *
 * The two CRSR keys have no keycaps of their own - the bottom row is full - so
 * they are the CURSOR mode's ↑←↓→ overlay on the WASD keys instead. Each key
 * `emits` a VIC-II button name (see c64Machine.ts).
 */

/** Index of the CURSOR layer in `layers` below. */
const CURSOR_LAYER = 3;

/**
 * A key: base label, optional shifted label, an empty SYM slot. Label tuple
 * order matches `layers` below: [base, shift, sym, cursor] - only the
 * symbol-hosting number keys populate SYM, only the four WASD keys CURSOR.
 */
const key = (id: string, emit: string, base: string, shift?: string): KeyDef =>
  kitKey(id, [base, shift ?? null, null, null], { emits: [emit] });

/**
 * A number-row key that also hosts one of the six C64 graphics-key symbols. It
 * keeps its digit + SHIFT punctuation and adds the symbol character on the SYM
 * layer. The key still emits its own digit matrix token, so the SYM character is
 * editor-only.
 */
const symbolKey = (
  id: string,
  base: string,
  shift: string,
  symChar: string,
): KeyDef => kitKey(id, [base, shift, symChar, null]);

const letter = (l: string, shift?: string): KeyDef => key(l, l, l, shift);

/**
 * A letter key that also carries a CURSOR-layer arrow. The legend moves the
 * editor caret and, on the machine, presses the CRSR key itself: the C64 reads
 * up and left as SHIFT over the two it has, which the machine folds in behind
 * these token names.
 */
const cursorLetter = (
  l: string,
  arrow: string,
  action: CursorAction,
  token: string,
  shift?: string,
): KeyDef =>
  withLegend(letter(l, shift), CURSOR_LAYER, cursorKey(arrow, action, token));

/** A bottom-row / strip key with only a main label (no shift, no SYM). */
const plainLabels = (main: Legend) => [lbl(main), null, null, null];

// Keys 1-6 double as the SYM layer's + - £ @ * ↑ (in physical keyboard order);
// those six keys' block graphics live in the palette, under their own keycaps.
const numberRow = [
  symbolKey('Num1', '1', '!', '+'),
  symbolKey('Num2', '2', '"', '-'),
  symbolKey('Num3', '3', '#', '£'),
  symbolKey('Num4', '4', '$', '@'),
  symbolKey('Num5', '5', '%', '*'),
  symbolKey('Num6', '6', '&', '↑'),
  key('Num7', 'Num7', '7', "'"),
  key('Num8', 'Num8', '8', '('),
  key('Num9', 'Num9', '9', ')'),
  key('Num0', 'Num0', '0'),
];

const qwertyRow = [
  letter('Q'),
  cursorLetter('W', '↑', 'up', 'CursorUp'),
  letter('E'),
  letter('R'),
  letter('T'),
  letter('Y'),
  letter('U'),
  letter('I'),
  letter('O'),
  letter('P'),
];

const homeRow = [
  cursorLetter('A', '←', 'left', 'CursorLeft', '+'),
  cursorLetter('S', '↓', 'down', 'CursorDown', '-'),
  cursorLetter('D', '→', 'right', 'CursorRight', '*'),
  letter('F', '/'),
  letter('G', '='),
  letter('H', ':'),
  letter('J', ';'),
  letter('K', '@'),
  letter('L', '£'),
  kitKey('Return', [act('↵', 'newline'), null, null, null]),
];

const zxcvRow = [
  letter('Z'),
  letter('X'),
  letter('C'),
  letter('V'),
  letter('B'),
  letter('N'),
  letter('M'),
  key('Comma', 'Comma', ',', '<'),
  key('Period', 'Period', '.', '>'),
  key('Slash', 'Slash', '/', '?'),
];

const shiftKey: KeyDef = {
  id: 'LeftShift',
  spanX: 6,
  emits: ['LeftShift'],
  modifier: 'shift',
  style: 'shift',
  labels: plainLabels('⇧'),
};

const commodoreKey: KeyDef = {
  id: 'Commodore',
  spanX: 5,
  emits: ['Commodore'],
  modifier: 'commodore',
  labels: plainLabels({ text: 'C=', editor: null }),
};

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: plainLabels(ins('␣', ' ')),
} satisfies Omit<KeyDef, 'spanX'>;

const quoteKey = kitKey('Quote', ['"', null, null, null], {
  emits: ['LeftShift', 'Num2'],
});

const backspaceKey = kitKey('InstDel', [
  act('⌫', 'backspace'),
  null,
  null,
  null,
]);

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRow([shiftKey, commodoreKey], spaceKey, [quoteKey, backspaceKey]),
];

// f1/f3/f5/f7 have their own matrix lines; f2/f4/f6/f8 are SHIFT of the odd keys.
const fnKey = (label: string, emits: string[]): KeyDef => ({
  id: `F${label.slice(1)}`,
  spanX: 4,
  emits,
  style: 'fn',
  labels: plainLabels({ text: label, editor: null }),
});

const functionKeys: KeyDef[] = [
  fnKey('f1', ['F1']),
  fnKey('f2', ['LeftShift', 'F1']),
  fnKey('f3', ['F3']),
  fnKey('f4', ['LeftShift', 'F3']),
  fnKey('f5', ['F5']),
  fnKey('f6', ['LeftShift', 'F5']),
  fnKey('f7', ['F7']),
  fnKey('f8', ['LeftShift', 'F7']),
];

export const c64KeyboardLayout: KeyboardLayout = {
  id: 'commodore64',
  name: 'Commodore 64',
  theme: 'vk-theme-commodore64',
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
    // The six graphics-key characters (+ - £ @ * ↑), pinned by the SYM mode.
    {
      id: 'sym',
      name: 'SYM',
      position: 'tl',
      activeWhen: [],
      editorInsertStyle: 'char',
    },
    // Bottom-right: SHIFT and SYM already hold the two top corners.
    {
      id: 'cursor',
      name: 'CURSOR',
      position: 'br',
      activeWhen: [],
    },
  ],
  editorModes: [
    { id: 'abc', name: 'ABC', layer: 'base' },
    { id: 'sym', name: 'SYM', layer: 'sym' },
    { id: 'cursor', name: 'CURSOR', layer: 'cursor' },
    // GRAPHICS shows the palette; it pins no layer, so SHIFT keeps its ordinary
    // meaning while the palette is open.
    { id: 'graphics', name: 'GRAPHICS', layer: 'base', palette: 'graphics' },
  ],
  modifiers: [
    { id: 'shift', emits: ['LeftShift'], sticky: true, lockable: true },
    { id: 'commodore', emits: ['Commodore'], sticky: true, lockable: true },
  ],
  rows,
  graphicsPalette: {
    sections: [
      { title: 'C= graphics', entries: C64_COMMODORE_GRAPHICS },
      { title: 'SHIFT graphics', entries: C64_SHIFT_GRAPHICS },
    ],
  },
  functionKeys,
  glyphs: {},
  // WASD movement + Space/Return fire (the convention the bundled C64 games use).
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
};
