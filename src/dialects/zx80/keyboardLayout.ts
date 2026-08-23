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
import { bottomRow, centerRow } from '../../keyboard/templateRows';
import { ZX80_GRAPHICS } from './graphics';

/**
 * The Sinclair ZX80 keyboard on the standard virtual-keyboard template.
 *
 * The ZX80 shares the ZX81's 8×5 matrix (so the machine key tokens - `emits` -
 * are identical) but has fewer legends. Each alphanumeric key carries up to
 * four:
 *  - main:     the letter / digit
 *  - shift:    the symbol/operator typed with SHIFT held
 *  - keyword:  the white K-mode command (pinned by the KEYWORD mode tab)
 *
 * As on the ZX81, the block graphics are shown as a palette rather than as key
 * legends (see ./graphics) - there are twenty-one of them and a keycap-sized
 * legend cannot tell them apart.
 *
 * The ZX80 has no FUNCTION cursor mode, so there is no function layer. As with
 * the rest of the template the dedicated cursor/HOME/RUBOUT keys are dropped and
 * a quote + backspace key live on the common bottom row.
 */

// Label tuple order matches `layers` below: [main, shift, keyword].
type Legends = [Legend, Legend, Legend];

const key = (token: string, legends: Legends): KeyDef =>
  kitKey(token, [...legends, null]);

/** Index of the CURSOR layer in `layers` below - the last of them. */
const CURSOR_LAYER = 3;

/**
 * A key that also carries a CURSOR-layer arrow. The machine has no arrow keys:
 * its cursor is SHIFT over 5/6/7/8, so the legend presses that pair rather
 * than the letter's own cell, exactly as the real keyboard would.
 */
const withCursor = (
  def: KeyDef,
  arrow: string,
  action: CursorAction,
  digit: string,
): KeyDef =>
  withLegend(def, CURSOR_LAYER, cursorKey(arrow, action, ['Shift', digit]));

const numberRow = [
  key('Digit1', ['1', word('NOT'), null]),
  key('Digit2', ['2', word('AND'), null]),
  key('Digit3', ['3', word('THEN'), null]),
  key('Digit4', ['4', word('TO'), null]),
  key('Digit5', ['5', { text: '←', editor: null }, null]),
  key('Digit6', ['6', { text: '↓', editor: null }, null]),
  key('Digit7', ['7', { text: '↑', editor: null }, null]),
  key('Digit8', ['8', { text: '→', editor: null }, null]),
  key('Digit9', ['9', null, null]),
  key('Digit0', ['0', null, null]),
];

const qwertyRow = [
  key('KeyQ', ['Q', null, 'NEW']),
  withCursor(key('KeyW', ['W', null, 'LOAD']), '↑', 'up', 'Digit7'),
  key('KeyE', ['E', null, 'SAVE']),
  key('KeyR', ['R', null, 'RUN']),
  key('KeyT', ['T', null, 'CONTINUE']),
  key('KeyY', ['Y', '"', 'REM']),
  key('KeyU', ['U', '$', 'IF']),
  key('KeyI', ['I', '(', 'INPUT']),
  key('KeyO', ['O', ')', 'PRINT']),
  key('KeyP', ['P', '*', null]),
];

const homeRow = [
  withCursor(key('KeyA', ['A', null, 'LIST']), '←', 'left', 'Digit5'),
  withCursor(key('KeyS', ['S', null, 'STOP']), '↓', 'down', 'Digit6'),
  withCursor(key('KeyD', ['D', null, 'DIM']), '→', 'right', 'Digit8'),
  key('KeyF', ['F', null, 'FOR']),
  key('KeyG', ['G', null, 'GOTO']),
  key('KeyH', ['H', '**', 'POKE']),
  // '−' is U+2212 (not in the ZX80 charset); insert the ASCII hyphen.
  key('KeyJ', ['J', ins('−', '-'), 'RANDOMISE']),
  key('KeyK', ['K', '+', 'LET']),
  key('KeyL', ['L', '=', null]),
  key('Enter', [act('↵', 'newline'), null, null]),
];

const zxcvRow = centerRow([
  key('KeyZ', ['Z', ':', null]),
  key('KeyX', ['X', ';', 'CLEAR']),
  key('KeyC', ['C', '?', 'CLS']),
  key('KeyV', ['V', '/', 'GOSUB']),
  key('KeyB', ['B', word('OR'), 'RETURN']),
  key('KeyN', ['N', '<', 'NEXT']),
  key('KeyM', ['M', '>', null]),
  key('Period', ['.', ',', null]),
]);

const shiftKey: KeyDef = {
  id: 'Shift',
  spanX: 6,
  emits: ['Shift'],
  modifier: 'shift',
  style: 'shift',
  labels: [{ text: '⇧' }, null, null, null],
};

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: '␣', editor: { insert: ' ' } }, { text: '£' }, null, null],
} satisfies Omit<KeyDef, 'spanX'>;

const quoteKey: KeyDef = {
  id: 'Quote',
  spanX: 4,
  emits: ['Shift', 'KeyY'],
  labels: [{ text: '"' }, null, null, null],
};

const backspaceKey: KeyDef = {
  id: 'Backspace',
  spanX: 4,
  emits: ['Shift', 'Digit0'],
  labels: [{ text: '⌫', editor: { action: 'backspace' } }, null, null, null],
};

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRow([shiftKey], spaceKey, [quoteKey, backspaceKey]),
];

export const zx80KeyboardLayout: KeyboardLayout = {
  id: 'zx80',
  name: 'ZX80',
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
      id: 'cursor',
      name: 'CURSOR',
      position: 'br',
      activeWhen: [],
    },
  ],
  editorModes: [
    { id: 'abc', name: 'ABC', layer: 'main' },
    { id: 'cursor', name: 'CURSOR', layer: 'cursor' },
    { id: 'keyword', name: 'KEYWORD', layer: 'keyword' },
    // No graphics key layer: the mode shows the palette, whose cells insert
    // the characters directly.
    { id: 'graphic', name: 'GRAPHICS', layer: 'main', palette: 'graphics' },
  ],
  modifiers: [{ id: 'shift', emits: ['Shift'], sticky: true, lockable: true }],
  rows,
  graphicsPalette: { sections: [{ entries: ZX80_GRAPHICS }] },
  glyphs: {},
  options: { minHoldFrames: 3, compactDefaultLayer: 'keyword' },
  // Sinclair joystick convention: 5/6/7/8 = left/down/up/right; Space/Enter as
  // fire (key-mapped mode).
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
};
