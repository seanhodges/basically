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
import { C64_COMMODORE_GRAPHICS, C64_SHIFT_GRAPHICS } from './graphics';

/**
 * The Commodore 64 keyboard on the standard virtual-keyboard template:
 * number row, ten-key QWERTY row, centred nine-key home row, the
 * SHIFT/INST-DEL-flanked bottom letter row, and a bottom row of C=, space,
 * quote, and Return at the far right.
 *
 * The machine's symbols live in the SYM mode at the template's canonical
 * positions, each cell pressing the C64's own key - the dedicated
 * `+ - £ @ * ↑ = : ; , . /` keys keep their matrix cells (see the token
 * table in c64Machine.ts) even though their keycaps left the board - or the
 * SHIFT pair the machine reads (`[` is SHIFT+`:`, `]` SHIFT+`;`). SHIFT
 * over a letter produces block graphics on the real machine, so the letter
 * keys carry no shifted legend; the graphics are the GRAPHICS palette's
 * job, in two sections (the C= set and the SHIFT set), each labelled with
 * the key and modifier that produces it.
 *
 * The four physical function keys yield eight values (f2/f4/f6/f8 are SHIFT of
 * the odd keys); all eight are shown as separate keys in the top strip, behind
 * the strip's mode/function toggle. RUN/STOP and RESTORE are dropped.
 *
 * The two CRSR keys have no keycaps of their own, so they are the CURSOR
 * mode's ↑←↓→ overlay on the WASD keys instead. Each key `emits` a VIC-II
 * button name (see c64Machine.ts).
 */

/** Index of the CURSOR layer in `layers` below. */
const CURSOR_LAYER = 2;

/**
 * A key: base label, optional shifted label. Label tuple order matches
 * `layers` below: [base, shift, cursor] - only the four WASD keys populate
 * CURSOR.
 */
const key = (id: string, emit: string, base: string, shift?: string): KeyDef =>
  kitKey(id, [base, shift ?? null, null], { emits: [emit] });

const letter = (l: string): KeyDef => key(l, l, l);

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
): KeyDef =>
  withLegend(letter(l), CURSOR_LAYER, cursorKey(arrow, action, token));

/** A bottom-row / strip key with only a main label (no shift). */
const plainLabels = (main: Legend) => [lbl(main), null, null];

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
  ...kitKey('InstDel', [act('⌫', 'backspace'), null, null]),
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

const commodoreKey: KeyDef = {
  id: 'Commodore',
  spanX: 6,
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

const quoteKey = kitKey('Quote', ['"', null, null], {
  emits: ['LeftShift', 'Num2'],
});

const returnKey: KeyDef = kitKey('Return', [act('↵', 'newline'), null, null], {
  spanX: 6,
});

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRow([commodoreKey], spaceKey, [quoteKey, returnKey]),
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

/**
 * How the C64 reaches each canonical SYM symbol: its dedicated symbol keys'
 * own matrix cells, the bracket pair the machine reads as SHIFT+`:` /
 * SHIFT+`;`, and the shifted number row. The `^` slot shows the machine's
 * own `↑` (the PETSCII exponent character).
 */
const C64_SYMBOLS: SymbolTable = {
  '+': { emits: ['Plus'] },
  '!': { emits: ['LeftShift', 'Num1'] },
  '-': { emits: ['Minus'] },
  '=': { emits: ['Equal'] },
  '/': { emits: ['Slash'] },
  '*': { emits: ['Asterisk'] },
  '<': { emits: ['LeftShift', 'Comma'] },
  '>': { emits: ['LeftShift', 'Period'] },
  '[': { emits: ['LeftShift', 'Colon'] },
  ']': { emits: ['LeftShift', 'Semicolon'] },
  '@': { emits: ['At'] },
  '#': { emits: ['LeftShift', 'Num3'] },
  $: { emits: ['LeftShift', 'Num4'] },
  '%': { emits: ['LeftShift', 'Num5'] },
  '^': { emits: ['UpArrow'], insert: '↑', text: '↑' },
  '&': { emits: ['LeftShift', 'Num6'] },
  '(': { emits: ['LeftShift', 'Num8'] },
  ')': { emits: ['LeftShift', 'Num9'] },
  "'": { emits: ['LeftShift', 'Num7'] },
  '"': { emits: ['LeftShift', 'Num2'] },
  ':': { emits: ['Colon'] },
  ';': { emits: ['Semicolon'] },
  ',': { emits: ['Comma'] },
  '.': { emits: ['Period'] },
  '£': { emits: ['Pound'] },
  '?': { emits: ['LeftShift', 'Slash'] },
};

export const c64KeyboardLayout: KeyboardLayout = withSymbolMode(
  {
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
    // WASD movement + Space/Return fire (the convention the bundled C64 games
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
  C64_SYMBOLS,
);
