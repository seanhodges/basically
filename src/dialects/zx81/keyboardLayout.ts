import type { KeyDef, KeyboardLayout } from '../../keyboard/layoutSchema';
import {
  type CursorAction,
  type Legend,
  act,
  cursorKey,
  ins,
  key as kitKey,
  withLegend,
  word,
} from '../../keyboard/legendKit';
import {
  type SymbolTable,
  bottomRow,
  centerRow,
  flankedRow,
  withSymbolMode,
} from '../../keyboard/templateRows';
import { ZX81_GRAPHICS } from './graphics';

/**
 * The ZX81 keyboard on the standard virtual-keyboard template: number row,
 * ten-key QWERTY row, centred nine-key home row, the shift/backspace-flanked
 * bottom letter row, and a bottom row ending quote-then-Enter - with the
 * machine's symbols in the SYM mode at the template's canonical positions,
 * each pressing the SHIFT combination (or the full-stop key) the real
 * keyboard sends.
 *
 * Each alphanumeric key still carries the authentic ZX81 legends:
 *  - main:     the big white character
 *  - shift:    the red symbol in the top-right corner (SHIFT held)
 *  - keyword:  the white K-mode keyword
 *  - function: the red FUNCTION-mode name
 *
 * The keyword and function legends stay printed on the keys, but are not
 * offered as input modes - keyword entry is the editor autocomplete's job.
 *
 * The block graphics are not key legends: there are twenty-one of them and they
 * would be illegible at keycap size, so the GRAPHICS mode shows them as a
 * palette instead (see ./graphics).
 *
 * The cursor keys are SHIFT + 5/6/7/8, so the arrows sit on those number keys,
 * where the machine prints them: they are the SHIFT legends there, and CURSOR
 * mode repeats them on the same keycaps so the pair can be sent without the
 * modifier held.
 */

// Label tuple order matches `layers` below: [main, shift, keyword, function].
type Legends = [Legend, Legend, Legend, Legend];

const key = (token: string, legends: Legends): KeyDef =>
  kitKey(token, [...legends, null]);

/** Index of the CURSOR layer in `layers` below - the last of them. */
const CURSOR_LAYER = 4;

/**
 * A digit key that is also one of the machine's cursor keys. Both legends move
 * the editor caret, and the CURSOR one presses SHIFT + the digit - the pair the
 * real keyboard sends - rather than the digit's own cell.
 */
const arrowDigit = (
  token: string,
  digit: string,
  arrow: string,
  action: CursorAction,
): KeyDef =>
  withLegend(
    key(token, [digit, act(arrow, action), null, null]),
    CURSOR_LAYER,
    cursorKey(arrow, action, ['Shift', token]),
  );

const numberRow = [
  key('Digit1', ['1', null, null, null]),
  key('Digit2', ['2', word('AND'), null, null]),
  key('Digit3', ['3', word('THEN'), null, null]),
  key('Digit4', ['4', word('TO'), null, null]),
  arrowDigit('Digit5', '5', '←', 'left'),
  arrowDigit('Digit6', '6', '↓', 'down'),
  arrowDigit('Digit7', '7', '↑', 'up'),
  arrowDigit('Digit8', '8', '→', 'right'),
  key('Digit9', ['9', null, null, null]),
  key('Digit0', ['0', null, null, null]),
];

const qwertyRow = [
  key('KeyQ', ['Q', '""', 'PLOT', 'SIN']),
  key('KeyW', ['W', word('OR'), 'UNPLOT', 'COS']),
  key('KeyE', ['E', word('STEP'), 'REM', 'TAN']),
  key('KeyR', ['R', '<=', 'RUN', 'INT']),
  key('KeyT', ['T', '<>', 'RAND', 'RND']),
  key('KeyY', ['Y', '>=', 'RETURN', 'STR$']),
  key('KeyU', ['U', '$', 'IF', 'CHR$']),
  key('KeyI', ['I', '(', 'INPUT', 'CODE']),
  key('KeyO', ['O', ')', 'POKE', 'PEEK']),
  key('KeyP', ['P', '"', 'PRINT', 'TAB']),
];

const homeRow = centerRow([
  key('KeyA', ['A', word('STOP'), 'NEW', 'ARCSIN']),
  key('KeyS', ['S', word('LPRINT'), 'SAVE', 'ARCCOS']),
  key('KeyD', ['D', word('SLOW'), 'DIM', 'ARCTAN']),
  key('KeyF', ['F', word('FAST'), 'FOR', 'SGN']),
  key('KeyG', ['G', word('LLIST'), 'GOTO', 'ABS']),
  key('KeyH', ['H', '**', 'GOSUB', 'SQR']),
  // '−' is U+2212 (not in the ZX81 charset); insert the ASCII hyphen.
  key('KeyJ', ['J', ins('−', '-'), 'LOAD', 'VAL']),
  key('KeyK', ['K', '+', 'LIST', 'LEN']),
  key('KeyL', ['L', '=', 'LET', 'USR']),
]);

const shiftKey: KeyDef = {
  id: 'Shift',
  spanX: 6,
  emits: ['Shift'],
  modifier: 'shift',
  style: 'shift',
  labels: [{ text: '⇧' }, null, null, null],
};

const backspaceKey: KeyDef = {
  id: 'Backspace',
  spanX: 6,
  emits: ['Shift', 'Digit0'],
  labels: [{ text: '⌫', editor: { action: 'backspace' } }, null, null, null],
};

const zxcvRow = flankedRow(
  shiftKey,
  [
    key('KeyZ', ['Z', ':', 'COPY', 'LN']),
    key('KeyX', ['X', ';', 'CLEAR', 'EXP']),
    key('KeyC', ['C', '?', 'CONT', 'AT']),
    key('KeyV', ['V', '/', 'CLS', null]),
    key('KeyB', ['B', '*', 'SCROLL', 'INKEY$']),
    key('KeyN', ['N', '<', 'NEXT', 'NOT']),
    key('KeyM', ['M', '>', 'PAUSE', 'PI']),
  ],
  backspaceKey,
);

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: '␣', editor: { insert: ' ' } }, { text: '£' }, null, null],
} satisfies Omit<KeyDef, 'spanX'>;

const quoteKey: KeyDef = {
  id: 'Quote',
  spanX: 4,
  emits: ['Shift', 'KeyP'],
  labels: [{ text: '"' }, null, null, null],
};

const enterKey: KeyDef = kitKey('Enter', [act('↵', 'newline')], { spanX: 6 });

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRow([], spaceKey, [quoteKey, enterKey]),
];

/**
 * How the ZX81 reaches each canonical SYM symbol: everything is SHIFT + a
 * key, except the full stop, whose own key keeps its matrix cell even though
 * the keycap left the board.
 */
const ZX81_SYMBOLS: SymbolTable = {
  '+': { emits: ['Shift', 'KeyK'] },
  '-': { emits: ['Shift', 'KeyJ'] },
  '=': { emits: ['Shift', 'KeyL'] },
  '/': { emits: ['Shift', 'KeyV'] },
  '*': { emits: ['Shift', 'KeyB'] },
  '<': { emits: ['Shift', 'KeyN'] },
  '>': { emits: ['Shift', 'KeyM'] },
  '(': { emits: ['Shift', 'KeyI'] },
  ')': { emits: ['Shift', 'KeyO'] },
  $: { emits: ['Shift', 'KeyU'] },
  '"': { emits: ['Shift', 'KeyP'] },
  ':': { emits: ['Shift', 'KeyZ'] },
  ';': { emits: ['Shift', 'KeyX'] },
  ',': { emits: ['Shift', 'Period'] },
  '.': { emits: ['Period'] },
  '?': { emits: ['Shift', 'KeyC'] },
  '£': { emits: ['Shift', 'Space'] },
};

export const zx81KeyboardLayout: KeyboardLayout = withSymbolMode(
  {
    id: 'zx81',
    name: 'ZX81',
    theme: 'vk-theme-zx81',
    gridColumns: 40,
    layers: [
      {
        id: 'main',
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
        id: 'keyword',
        name: 'KEYWORD',
        position: 'bl',
        activeWhen: [],
        editorInsertStyle: 'word',
      },
      {
        id: 'function',
        name: 'FUNCTION',
        position: 'below',
        activeWhen: [],
        editorInsertStyle: 'word',
      },
      {
        id: 'cursor',
        name: 'CURSOR',
        position: 'br',
        activeWhen: [],
      },
    ],
    editorModes: [
      { id: 'abc', name: 'ABC', layer: 'main' },
      { id: 'cursor', name: 'CURSOR', layer: 'cursor' },
      // The graphics have no key layer of their own; the mode shows the palette
      // below, whose cells insert the characters directly.
      { id: 'graphic', name: 'GRAPHICS', layer: 'main', palette: 'graphics' },
    ],
    modifiers: [
      { id: 'shift', emits: ['Shift'], sticky: true, lockable: true },
    ],
    rows,
    graphicsPalette: { sections: [{ entries: ZX81_GRAPHICS }] },
    glyphs: {},
    options: { minHoldFrames: 3, compactDefaultLayer: 'keyword' },
    // Sinclair joystick convention: 5/6/7/8 = left/down/up/right; Space/Enter
    // as fire (key-mapped mode).
    controller: {
      bindings: {
        up: 'Digit7',
        down: 'Digit6',
        left: 'Digit5',
        right: 'Digit8',
        fire1: 'Space',
        fire2: 'Enter',
      },
    },
  },
  ZX81_SYMBOLS,
);
