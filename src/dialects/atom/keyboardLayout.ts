import type { KeyDef, KeyboardLayout } from '../../keyboard/layoutSchema';
import {
  type Legend,
  act,
  cursorKey,
  key as kitKey,
} from '../../keyboard/legendKit';
import {
  type SymbolTable,
  bottomRow,
  centerRow,
  flankedRow,
  withSymbolMode,
} from '../../keyboard/templateRows';
import { ATOM_GRAPHICS } from './graphics';

/**
 * The Acorn Atom keyboard on the standard virtual-keyboard template: number
 * row, ten-key QWERTY row, centred nine-key home row, the
 * shift/delete-flanked bottom letter row, and a bottom row of Escape, space,
 * quote, and Enter at the far right.
 *
 * Two character layers:
 *  - base:     the unshifted character
 *  - shifted:  the shifted symbol (top-left), active while SHIFT is held
 *
 * Key tokens are the DOM-code-style names the Atom adapter's matrix understands
 * (`matrixForToken` in `src/emulator/atom/keyboard.ts`: 'KeyA', 'Digit1',
 * 'Enter', 'Comma'…). The machine's punctuation lives in the SYM mode at the
 * template's canonical positions, each cell pressing the Atom's own key or
 * SHIFT pair - the dedicated `- ; : @ [ ] \ ↑ , . /` keys keep their matrix
 * cells even though their keycaps left the board, and the adapter's constant
 * names (MINUS_EQUALS, SEMICOLON_PLUS, COLON_STAR, COMMA_LESSTHAN…) record
 * the shift pairs.
 *
 * A `cursor` layer (pinned by the CURSOR mode tab, top-right on the keycap)
 * overlays `↑ ← ↓ →` on the W/A/S/D keys, moving the editor caret - the same
 * concept as the CPC 464 sibling. Every other key between the number row and
 * the bottom row is blank and inert in CURSOR mode.
 *
 * A GRAPHICS mode tab pins no layer of its own: it swaps the key grid for the
 * Semigraphics-6 palette in {@link import('./graphics').ATOM_GRAPHICS}, since
 * the machine printed no graphics on any keycap.
 */

/** The two character layers, index-aligned with `layout.layers` below. */
type Legends = [Legend, Legend];

/**
 * A standard key: [base, shifted] legends plus an optional CURSOR-layer
 * legend (the ↑←↓→ overlay on the WASD keys), one matrix token.
 */
const key = (token: string, legends: Legends, cursor: Legend = null): KeyDef =>
  kitKey(token, [...legends, cursor]);

const numberRow = [
  key('Digit1', ['1', null]),
  key('Digit2', ['2', null]),
  key('Digit3', ['3', null]),
  key('Digit4', ['4', null]),
  key('Digit5', ['5', null]),
  key('Digit6', ['6', null]),
  key('Digit7', ['7', null]),
  key('Digit8', ['8', null]),
  key('Digit9', ['9', null]),
  key('Digit0', ['0', null]),
];

const qwertyRow = [
  key('KeyQ', ['Q', null]),
  key('KeyW', ['W', null], cursorKey('↑', 'up', 'ArrowUp')),
  key('KeyE', ['E', null]),
  key('KeyR', ['R', null]),
  key('KeyT', ['T', null]),
  key('KeyY', ['Y', null]),
  key('KeyU', ['U', null]),
  key('KeyI', ['I', null]),
  key('KeyO', ['O', null]),
  key('KeyP', ['P', null]),
];

const homeRow = centerRow([
  key('KeyA', ['A', null], cursorKey('←', 'left', 'ArrowLeft')),
  key('KeyS', ['S', null], cursorKey('↓', 'down', 'ArrowDown')),
  key('KeyD', ['D', null], cursorKey('→', 'right', 'ArrowRight')),
  key('KeyF', ['F', null]),
  key('KeyG', ['G', null]),
  key('KeyH', ['H', null]),
  key('KeyJ', ['J', null]),
  key('KeyK', ['K', null]),
  key('KeyL', ['L', null]),
]);

const shiftKey: KeyDef = {
  id: 'Shift',
  spanX: 6,
  emits: ['Shift'],
  modifier: 'shift',
  style: 'shift',
  labels: [{ text: '⇧' }, null, null],
};

const deleteKey: KeyDef = {
  id: 'Delete',
  spanX: 6,
  emits: ['Delete'],
  labels: [{ text: '⌫', editor: { action: 'backspace' } }, null, null],
};

const zxcvRow = flankedRow(
  shiftKey,
  [
    key('KeyZ', ['Z', null]),
    key('KeyX', ['X', null]),
    key('KeyC', ['C', null]),
    key('KeyV', ['V', null]),
    key('KeyB', ['B', null]),
    key('KeyN', ['N', null]),
    key('KeyM', ['M', null]),
  ],
  deleteKey,
);

/** Escape, in the bottom-left machine region; no editor insert. */
const escKey: KeyDef = {
  id: 'Escape',
  spanX: 4,
  emits: ['Escape'],
  labels: [{ text: 'Esc', editor: null }, null, null],
};

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: '␣', editor: { insert: ' ' } }, null, null],
} satisfies Omit<KeyDef, 'spanX'>;

/** A double quote, typed as SHIFT+2 on the Atom matrix. */
const quoteKey: KeyDef = {
  id: 'Quote',
  spanX: 4,
  emits: ['Shift', 'Digit2'],
  labels: [{ text: '"' }, null, null],
};

const enterKey: KeyDef = kitKey('Enter', [act('↵', 'newline')], { spanX: 6 });

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRow([escKey], spaceKey, [quoteKey, enterKey]),
];

/**
 * How the Atom reaches each canonical SYM symbol. The dedicated keys' shift
 * pairs come from the matrix constants' own names (MINUS_EQUALS,
 * SEMICOLON_PLUS, COLON_STAR, COMMA_LESSTHAN, PERIOD_GREATERTHAN,
 * SLASH_QUESTIONMARK); the rest are the shifted number row.
 */
const ATOM_SYMBOLS: SymbolTable = {
  '+': { emits: ['Shift', 'Semicolon'] },
  '!': { emits: ['Shift', 'Digit1'] },
  '-': { emits: ['Minus'] },
  '=': { emits: ['Shift', 'Minus'] },
  '/': { emits: ['Slash'] },
  '<': { emits: ['Shift', 'Comma'] },
  '>': { emits: ['Shift', 'Period'] },
  '[': { emits: ['BracketLeft'] },
  ']': { emits: ['BracketRight'] },
  '@': { emits: ['At'] },
  '#': { emits: ['Shift', 'Digit3'] },
  $: { emits: ['Shift', 'Digit4'] },
  '%': { emits: ['Shift', 'Digit5'] },
  '^': { emits: ['UpArrow'] },
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
  '\\': { emits: ['Backslash'] },
  '?': { emits: ['Shift', 'Slash'] },
};

export const atomKeyboardLayout: KeyboardLayout = withSymbolMode(
  {
    id: 'atom',
    name: 'Acorn Atom',
    theme: 'vk-theme-atom',
    gridColumns: 40,
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
      // The Atom prints no graphics on its keycaps and its BASIC has no CHR$,
      // so this mode pins no layer: the palette below carries the
      // Semigraphics-6 cells and labels each with the byte a program puts in a
      // string literal.
      { id: 'graphic', name: 'GRAPHICS', layer: 'base', palette: 'graphics' },
    ],
    modifiers: [
      { id: 'shift', emits: ['Shift'], sticky: true, lockable: true },
    ],
    rows,
    graphicsPalette: {
      sections: [{ title: 'Semigraphics 6 (161–223)', entries: ATOM_GRAPHICS }],
    },
    glyphs: {},
    options: { minHoldFrames: 4 },
    // Acorn convention: Z/X = left/right, K/M = up/down; Space / Return as
    // fire.
    controller: {
      bindings: {
        up: 'KeyK',
        down: 'KeyM',
        left: 'KeyZ',
        right: 'KeyX',
        fire1: 'Space',
        fire2: 'Enter',
      },
    },
  },
  ATOM_SYMBOLS,
);
