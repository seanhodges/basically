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
import {
  type SymbolTable,
  bottomRow,
  centerRow,
  flankedRow,
  withSymbolMode,
} from '../../keyboard/templateRows';
import { C64_SHIFT_GRAPHICS } from '../commodore64/graphics';

/**
 * The Commodore PET graphics keyboard on the standard virtual-keyboard
 * template: number row, ten-key QWERTY row, centred nine-key home row, the
 * SHIFT/INST-DEL-flanked bottom letter row, and a bottom row of space,
 * quote, and Return at the far right.
 *
 * The PET graphics keyboard gives nearly every symbol a dedicated key, so
 * the SYM mode's canonical cells press those keys' own matrix cells (the
 * direct-key tokens in `../../emulator/pet/keyboard.ts`: `! # $ % & ( ) "
 * ' \ @ [ ] < > - = : ; * , . ? + /` and the ↑ key). SHIFT over a letter
 * draws a block graphic on the real machine, so the letter keys carry no
 * shifted legend, and the pad digits shift to nothing, so neither do the
 * digits: the single block-graphics set - the one printed on the *front* of
 * every letter key (there is no Commodore key, so unlike the C64 there is
 * no second, C=, set) - is the GRAPHICS palette's job, reusing the shared
 * C64 SHIFT graphics (`../commodore64/graphics`, `C64_SHIFT_GRAPHICS`),
 * each cell labelled with the SHIFT+key that draws it.
 *
 * RUN/STOP and the numeric-pad duplicates are dropped from the on-screen
 * keyboard; the ten digit keys stand in for the pad. The two CRSR keys have
 * no keycaps of their own, so they are the CURSOR mode's ↑←↓→ overlay on
 * the WASD keys instead.
 */

/** Index of the CURSOR layer in `layers` below. */
const CURSOR_LAYER = 1;

/**
 * A key, named for its position but emitting the PET's own matrix token.
 * Label tuple order matches `layers` below: [base, cursor] - only the four
 * WASD keys populate the last.
 */
const key = (id: string, emit: string, base: string): KeyDef =>
  kitKey(id, [base, null], { emits: [emit] });

const letter = (l: string): KeyDef => key(l, l, l);

/**
 * A letter key that also carries a CURSOR-layer arrow. The legend moves the
 * editor caret and, on the machine, presses the CRSR key itself: the PET reads
 * up and left as SHIFT over the two it has, which the machine folds in behind
 * these token names.
 */
const cursorLetter = (
  l: string,
  arrow: string,
  action: CursorAction,
  token: string,
): KeyDef =>
  withLegend(letter(l), CURSOR_LAYER, cursorKey(arrow, action, token));

/** A bottom-row key with only a main label. */
const plainLabels = (main: Legend) => [lbl(main), null];

const numberRow = [
  key('Num1', 'Num1', '1'),
  key('Num2', 'Num2', '2'),
  key('Num3', 'Num3', '3'),
  key('Num4', 'Num4', '4'),
  key('Num5', 'Num5', '5'),
  key('Num6', 'Num6', '6'),
  key('Num7', 'Num7', '7'),
  key('Num8', 'Num8', '8'),
  key('Num9', 'Num9', '9'),
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

const homeRow = centerRow([
  cursorLetter('A', '←', 'left', 'CursorLeft'),
  cursorLetter('S', '↓', 'down', 'CursorDown'),
  cursorLetter('D', '→', 'right', 'CursorRight'),
  letter('F'),
  letter('G'),
  letter('H'),
  letter('J'),
  letter('K'),
  letter('L'),
]);

const shiftKey: KeyDef = {
  id: 'LeftShift',
  spanX: 6,
  emits: ['LeftShift'],
  modifier: 'shift',
  style: 'shift',
  labels: plainLabels('⇧'),
};

const backspaceKey: KeyDef = {
  ...kitKey('InstDel', [act('⌫', 'backspace'), null]),
  spanX: 6,
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

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: plainLabels(ins('␣', ' ')),
} satisfies Omit<KeyDef, 'spanX'>;

// The PET graphics keyboard has a dedicated " key (matrix token '"').
const quoteKey = kitKey('Quote', ['"', null], { emits: ['"'] });

const returnKey: KeyDef = kitKey('Return', [act('↵', 'newline'), null], {
  spanX: 6,
});

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRow([], spaceKey, [quoteKey, returnKey]),
];

/**
 * How the PET reaches each canonical SYM symbol: its graphics keyboard's
 * own dedicated key for every one (the token *is* the symbol), with the
 * `^` slot showing the machine's own `↑` via the up-arrow key.
 */
const PET_SYMBOLS: SymbolTable = {
  '+': { emits: ['+'] },
  '-': { emits: ['-'] },
  '=': { emits: ['='] },
  '/': { emits: ['/'] },
  '*': { emits: ['*'] },
  '<': { emits: ['<'] },
  '>': { emits: ['>'] },
  '[': { emits: ['['] },
  ']': { emits: [']'] },
  '@': { emits: ['@'] },
  '#': { emits: ['#'] },
  $: { emits: ['$'] },
  '%': { emits: ['%'] },
  '^': { emits: ['UpArrow'], insert: '↑', text: '↑' },
  '&': { emits: ['&'] },
  '(': { emits: ['('] },
  ')': { emits: [')'] },
  "'": { emits: ["'"] },
  '"': { emits: ['"'] },
  ':': { emits: [':'] },
  ';': { emits: [';'] },
  ',': { emits: [','] },
  '.': { emits: ['.'] },
  '!': { emits: ['!'] },
  // The token is named for the keycap, but PETSCII 0x5C is £ - that is the
  // character the key types (proved on the ROM).
  '£': { emits: ['\\'] },
  '?': { emits: ['?'] },
};

export const petKeyboardLayout: KeyboardLayout = withSymbolMode(
  {
    id: 'pet',
    name: 'Commodore PET',
    theme: 'vk-theme-pet',
    gridColumns: 40,
    layers: [
      {
        id: 'base',
        position: 'center',
        activeWhen: [],
        editorInsertStyle: 'char',
      },
      {
        id: 'cursor',
        name: 'CURSOR',
        position: 'br',
        activeWhen: [],
        modeOnly: true,
      },
    ],
    editorModes: [
      { id: 'abc', name: 'ABC', layer: 'base' },
      { id: 'cursor', name: 'CURSOR', layer: 'cursor' },
      // GRAPHICS shows the palette; it pins no layer, so SHIFT keeps its
      // ordinary meaning while the palette is open.
      { id: 'graphics', name: 'GRAPHICS', layer: 'base', palette: 'graphics' },
    ],
    modifiers: [
      { id: 'shift', emits: ['LeftShift'], sticky: true, lockable: true },
    ],
    rows,
    // One set only: the PET has no Commodore key, so the graphics printed on
    // the key fronts are reached with SHIFT.
    graphicsPalette: { sections: [{ entries: C64_SHIFT_GRAPHICS }] },
    glyphs: {},
    // WASD movement + Space/Return fire (the convention the bundled PET games
    // use).
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
  PET_SYMBOLS,
);
