import type { KeyDef, KeyboardLayout } from '../../keyboard/layoutSchema';
import {
  type CursorAction,
  type Legend,
  act,
  cursorKey,
  key as kitKey,
  withLegend,
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
 * Each alphanumeric key carries:
 *  - main:     the big white character
 *  - shift:    the cursor arrows on 5-8 - the one thing SHIFT still marks,
 *    now that symbols are the SYM mode's work alone
 *  - keyword:  the white K-mode keyword
 *  - function: the red FUNCTION-mode name
 *
 * The keyword and function layers are markings, not input modes - keyword
 * entry is the editor autocomplete's job, and the SYM mode is the only way to
 * type a symbol (bar the quote key). A key prints one marking at a time, so
 * they show only where no mode or modifier selects another.
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
  key('Digit2', ['2', null, null, null]),
  key('Digit3', ['3', null, null, null]),
  key('Digit4', ['4', null, null, null]),
  arrowDigit('Digit5', '5', '←', 'left'),
  arrowDigit('Digit6', '6', '↓', 'down'),
  arrowDigit('Digit7', '7', '↑', 'up'),
  arrowDigit('Digit8', '8', '→', 'right'),
  key('Digit9', ['9', null, null, null]),
  key('Digit0', ['0', null, null, null]),
];

const qwertyRow = [
  key('KeyQ', ['Q', null, 'PLOT', 'SIN']),
  key('KeyW', ['W', null, 'UNPLOT', 'COS']),
  key('KeyE', ['E', null, 'REM', 'TAN']),
  key('KeyR', ['R', null, 'RUN', 'INT']),
  key('KeyT', ['T', null, 'RAND', 'RND']),
  key('KeyY', ['Y', null, 'RETURN', 'STR$']),
  key('KeyU', ['U', null, 'IF', 'CHR$']),
  key('KeyI', ['I', null, 'INPUT', 'CODE']),
  key('KeyO', ['O', null, 'POKE', 'PEEK']),
  key('KeyP', ['P', null, 'PRINT', 'TAB']),
];

const homeRow = centerRow([
  key('KeyA', ['A', null, 'NEW', 'ARCSIN']),
  key('KeyS', ['S', null, 'SAVE', 'ARCCOS']),
  key('KeyD', ['D', null, 'DIM', 'ARCTAN']),
  key('KeyF', ['F', null, 'FOR', 'SGN']),
  key('KeyG', ['G', null, 'GOTO', 'ABS']),
  key('KeyH', ['H', null, 'GOSUB', 'SQR']),
  key('KeyJ', ['J', null, 'LOAD', 'VAL']),
  key('KeyK', ['K', null, 'LIST', 'LEN']),
  key('KeyL', ['L', null, 'LET', 'USR']),
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
    key('KeyZ', ['Z', null, 'COPY', 'LN']),
    key('KeyX', ['X', null, 'CLEAR', 'EXP']),
    key('KeyC', ['C', null, 'CONT', 'AT']),
    key('KeyV', ['V', null, 'CLS', null]),
    key('KeyB', ['B', null, 'SCROLL', 'INKEY$']),
    key('KeyN', ['N', null, 'NEXT', 'NOT']),
    key('KeyM', ['M', null, 'PAUSE', 'PI']),
  ],
  backspaceKey,
);

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: '␣', editor: { insert: ' ' } }, null, null, null],
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
        modeOnly: true,
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
