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
import {
  BBC_LOW_MOSAICS,
  BBC_HIGH_MOSAICS,
  BBC_GRAPHICS_COLOURS,
  BBC_GRAPHICS_STYLES,
} from './graphics';

/**
 * The BBC Micro Model B keyboard on the standard virtual-keyboard template:
 * number row, ten-key QWERTY row, centred nine-key home row, the
 * shift/delete-flanked bottom letter row, and a bottom row of Escape, space,
 * quote, and Enter at the far right.
 *
 * Two character layers:
 *  - base:     the unshifted character
 *  - shifted:  the shifted symbol (top-left), active while SHIFT is held
 *
 * The machine's punctuation lives in the SYM mode at the template's
 * canonical positions, each cell pressing the BBC's own key or SHIFT pair -
 * the dedicated keys keep their matrix cells even though their keycaps left
 * the board, and the jsbeeb constant names (MINUS, HAT_TILDE,
 * PIPE_BACKSLASH, UNDERSCORE_POUND, SEMICOLON_PLUS, COLON_STAR…) record the
 * shift pairs. The f0–f9 function keys live in the top strip behind the
 * mode/function toggle.
 *
 * A `cursor` layer (pinned by the CURSOR mode tab, top-right on the keycap)
 * overlays `↑ ← ↓ →` on the W/A/S/D keys, moving the editor caret - the
 * same concept as the CPC 464 sibling. Non-WASD keys keep typing normally in
 * CURSOR mode via the base-layer fallback.
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
  key('Digit1', ['1', '!']),
  key('Digit2', ['2', '"']),
  // OS 1.2 types _ for SHIFT+3, not the # a modern keyboard puts there
  // (# is SHIFT + the pound key); proved on the ROM.
  key('Digit3', ['3', '_']),
  key('Digit4', ['4', '$']),
  key('Digit5', ['5', '%']),
  key('Digit6', ['6', '&']),
  key('Digit7', ['7', "'"]),
  key('Digit8', ['8', '(']),
  key('Digit9', ['9', ')']),
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

const functionKeys: KeyDef[] = Array.from({ length: 10 }, (_, i) => ({
  id: `F${i}`,
  spanX: 4,
  emits: [`F${i}`],
  style: 'fn',
  labels: [{ text: `f${i}`, editor: null }, null, null],
}));

/**
 * How the BBC reaches each canonical SYM symbol, every pair proved on the
 * OS 1.2 ROM: the dedicated keys carry `-=`, `^~`, `\|`, `[{`, `]}`, `;+`,
 * `:*`, `,<`, `.>`, `/?`; the pound key gives £ unshifted and # shifted;
 * and SHIFT+3 types `_` (not the # a modern keyboard puts there).
 */
const BBC_SYMBOLS: SymbolTable = {
  '+': { emits: ['Shift', 'Semicolon'] },
  '!': { emits: ['Shift', 'Digit1'] },
  '-': { emits: ['Minus'] },
  '=': { emits: ['Shift', 'Minus'] },
  '/': { emits: ['Slash'] },
  _: { emits: ['Shift', 'Digit3'] },
  '<': { emits: ['Shift', 'Comma'] },
  '>': { emits: ['Shift', 'Period'] },
  '[': { emits: ['BracketLeft'] },
  ']': { emits: ['BracketRight'] },
  '@': { emits: ['At'] },
  '#': { emits: ['Shift', 'Underscore'] },
  $: { emits: ['Shift', 'Digit4'] },
  '%': { emits: ['Shift', 'Digit5'] },
  '^': { emits: ['Caret'] },
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
  '~': { emits: ['Shift', 'Caret'] },
  '\\': { emits: ['Backslash'] },
  '|': { emits: ['Shift', 'Backslash'] },
  '{': { emits: ['Shift', 'BracketLeft'] },
  '}': { emits: ['Shift', 'BracketRight'] },
  '£': { emits: ['Underscore'] },
  '?': { emits: ['Shift', 'Slash'] },
};

export const bbcKeyboardLayout: KeyboardLayout = withSymbolMode(
  {
    id: 'bbcmicro',
    name: 'BBC Micro',
    theme: 'vk-theme-bbc',
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
      },
    ],
    editorModes: [
      { id: 'abc', name: 'ABC', layer: 'base' },
      { id: 'cursor', name: 'CURSOR', layer: 'cursor' },
      // The BBC prints no graphics on its keycaps, so this mode pins no layer:
      // the palette below carries the MODE 7 mosaics and labels each with the
      // code CHR$ takes, which is how the machine itself reached them.
      { id: 'graphic', name: 'GRAPHICS', layer: 'base', palette: 'graphics' },
    ],
    modifiers: [
      { id: 'shift', emits: ['Shift'], sticky: true, lockable: true },
    ],
    rows,
    graphicsPalette: {
      sections: [
        {
          title: 'Graphics colour – CHR$(145)–CHR$(151)',
          note: 'MODE 7 prints the mosaics below as letters until one of these appears earlier on the same screen line.',
          entries: BBC_GRAPHICS_COLOURS,
        },
        { title: 'Mosaics – CHR$(161)–CHR$(191)', entries: BBC_LOW_MOSAICS },
        { title: 'Mosaics – CHR$(224)–CHR$(255)', entries: BBC_HIGH_MOSAICS },
        {
          title: 'Graphics style – CHR$(153), CHR$(154), CHR$(158), CHR$(159)',
          entries: BBC_GRAPHICS_STYLES,
        },
      ],
    },
    functionKeys,
    glyphs: {},
    options: { minHoldFrames: 4 },
    // BBC convention: Z/X = left/right, K/M = up/down; Space / Return as fire.
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
  BBC_SYMBOLS,
);
