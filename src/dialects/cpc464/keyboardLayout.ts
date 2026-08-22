import type {
  EditorKeyAction,
  KeyDef,
  KeyLabel,
  KeyboardLayout,
} from '../../keyboard/layoutSchema';
import { bottomRow, centerRow } from '../../keyboard/templateRows';
import {
  CPC_LINE_GRAPHICS,
  CPC_MOSAIC_GRAPHICS,
  CPC_SHADE_GRAPHICS,
} from './graphics';

/**
 * The Amstrad CPC 464 keyboard as pure layout data.
 *
 * Three layers, like the BBC/Atom siblings:
 *  - base:    the unshifted character
 *  - shifted: the shifted symbol (top-left), active while SHIFT is held
 *  - sym:     the punctuation overflow (pinned by the SYM mode tab)
 *
 * Key tokens are exactly the matrix tokens the emulator's `setKey` decodes
 * (`src/emulator/cpc/keyboard.ts` — single letters `A`-`Z`, `Digit0`-`Digit9`,
 * `Return`, `Del`, `Shift`, `CursorUp`…, `F0`-`F9`), so the virtual
 * keyboard and the physical `keyEvent` map share one vocabulary. The CPC has
 * more dedicated punctuation keys (`- = ^ @ [ ] : ; \\ …`) than fit a uniform
 * ten-key grid, so — as the BBC/Atom layouts do — the overflow symbols are the
 * SYM mode's editor inserts on the number/QWERTY rows; the key still emits its
 * base matrix token, but code is written in the editor where SYM applies.
 *
 * The main block sits on the standard 40-column five-row template, assembled
 * with the shared `templateRows` helpers (`centerRow`/`bottomRow`) like every
 * other dialect: the bottom row is SHIFT · a centred SPACE · " · DEL. Rather
 * than four dedicated cursor keys, the cursor cluster is a CURSOR mode that
 * overlays `↑ ← ↓ →` on the W/A/S/D keys (moving the editor caret); the real
 * `CursorUp`/… matrix cells stay reachable via the physical arrow keys and the
 * keyboard-joystick, which binds to them through `controllerKeys`. The
 * numeric-keypad function keys `f0`-`f9` live in the top strip. The 464's
 * coloured keycaps come from the `vk-theme-cpc464` block in VirtualKeyboard.css;
 * the CPC 6128 sibling (`../cpc6128/`) re-exports these rows under its own theme.
 */

type Legend =
  | string
  | { text: string; editor: EditorKeyAction | null; emits?: string[] }
  | null;
type Legends = [Legend, Legend, Legend];

/** Legend bound to an editing action. */
const act = (
  text: string,
  action: 'backspace' | 'newline' | 'left' | 'right' | 'up' | 'down',
): Legend => ({ text, editor: { action } });

/**
 * A CURSOR-layer legend: it moves the editor caret, and on the machine it
 * presses the cursor cluster's own matrix cell instead of the letter the keycap
 * carries on its base layer.
 */
const cursorKey = (
  text: string,
  action: 'left' | 'right' | 'up' | 'down',
  token: string,
): Legend => ({ text, editor: { action }, emits: [token] });

const lbl = (legend: Legend): KeyLabel | null =>
  legend === null
    ? null
    : typeof legend === 'string'
      ? { text: legend }
      : {
          text: legend.text,
          editor: legend.editor,
          ...(legend.emits ? { emits: legend.emits } : {}),
        };

/**
 * A standard key: [base, shifted, sym] legends plus an optional CURSOR-layer
 * legend (the ↑←↓→ overlay on the WASD keys), one matrix token. The four layers
 * are index-aligned with `layout.layers` below.
 */
function key(token: string, legends: Legends, cursor: Legend = null): KeyDef {
  return {
    id: token,
    spanX: 4,
    emits: [token],
    labels: [...legends.map(lbl), lbl(cursor)],
  };
}

// Shifted number row + the SYM punctuation overflow (editor inserts only).
const numberRow = [
  key('Digit1', ['1', '!', '-']),
  key('Digit2', ['2', '"', '=']),
  key('Digit3', ['3', '#', '+']),
  key('Digit4', ['4', '$', '*']),
  key('Digit5', ['5', '%', '^']),
  key('Digit6', ['6', '&', '@']),
  key('Digit7', ['7', "'", '[']),
  key('Digit8', ['8', '(', ']']),
  key('Digit9', ['9', ')', ':']),
  key('Digit0', ['0', '_', ';']),
];

const qwertyRow = [
  key('Q', ['Q', null, '{']),
  key('W', ['W', null, '}'], cursorKey('↑', 'up', 'CursorUp')),
  key('E', ['E', null, '\\']),
  key('R', ['R', null, '|']),
  key('T', ['T', null, '£']),
  key('Y', ['Y', null, '~']),
  key('U', ['U', null, null]),
  key('I', ['I', null, null]),
  key('O', ['O', null, null]),
  key('P', ['P', null, null]),
];

const homeRow = [
  key('A', ['A', null, null], cursorKey('←', 'left', 'CursorLeft')),
  key('S', ['S', null, null], cursorKey('↓', 'down', 'CursorDown')),
  key('D', ['D', null, null], cursorKey('→', 'right', 'CursorRight')),
  key('F', ['F', null, null]),
  key('G', ['G', null, null]),
  key('H', ['H', null, null]),
  key('J', ['J', null, null]),
  key('K', ['K', null, null]),
  key('L', ['L', null, null]),
  {
    id: 'Return',
    spanX: 4,
    emits: ['Return'],
    labels: [lbl(act('↵', 'newline')), null, null, null],
  } satisfies KeyDef,
];

const zxcvRow = centerRow([
  key('Z', ['Z', null, null]),
  key('X', ['X', null, null]),
  key('C', ['C', null, null]),
  key('V', ['V', null, null]),
  key('B', ['B', null, null]),
  key('N', ['N', null, null]),
  key('M', ['M', null, null]),
  key('Comma', [',', '<', null]),
  key('Period', ['.', '>', null]),
  key('Slash', ['/', '?', null]),
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
  labels: [{ text: '␣', editor: { insert: ' ' } }, null, null, null],
} satisfies Omit<KeyDef, 'spanX'>;

const delKey: KeyDef = {
  id: 'Del',
  spanX: 4,
  emits: ['Del'],
  labels: [{ text: '⌫', editor: { action: 'backspace' } }, null, null, null],
};

/** Double quote, typed as SHIFT+2 on the CPC matrix (as the BBC/Atom do). */
const quoteKey: KeyDef = {
  id: 'Quote',
  spanX: 4,
  emits: ['Shift', 'Digit2'],
  labels: [{ text: '"' }, null, null, null],
};

// Bottom row: SHIFT · centred SPACE · " · DEL, via the shared helper that pads
// the flanks and sizes the space bar to the 40-col grid (BBC/Atom shape).
const bottomRowKeys: KeyDef[] = bottomRow([shiftKey], spaceKey, [
  quoteKey,
  delKey,
]);

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRowKeys,
];

// The numeric-keypad function keys f0–f9, in the top strip behind the toggle.
const functionKeys: KeyDef[] = Array.from({ length: 10 }, (_, i) => ({
  id: `F${i}`,
  spanX: 4,
  emits: [`F${i}`],
  style: 'fn',
  labels: [{ text: `f${i}`, editor: null }, null, null, null],
}));

// The cursor cluster is not a set of keycaps (it's the CURSOR overlay on WASD),
// but the keyboard-joystick still presses the real matrix cells, so the four
// keys live here as controller-only bindings the renderer never draws.
const cursorControllerKey = (token: string, glyph: string): KeyDef => ({
  id: token,
  spanX: 4,
  emits: [token],
  style: 'cursor',
  labels: [{ text: glyph }, null, null, null],
});

const controllerKeys: KeyDef[] = [
  cursorControllerKey('CursorUp', '↑'),
  cursorControllerKey('CursorDown', '↓'),
  cursorControllerKey('CursorLeft', '←'),
  cursorControllerKey('CursorRight', '→'),
];

export const cpc464KeyboardLayout: KeyboardLayout = {
  id: 'cpc464',
  name: 'CPC 464',
  theme: 'vk-theme-cpc464',
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
      id: 'sym',
      name: 'SYM',
      position: 'br',
      activeWhen: [],
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
    { id: 'sym', name: 'SYM', layer: 'sym' },
    { id: 'cursor', name: 'CURSOR', layer: 'cursor' },
    // The CPC prints no graphics on its keycaps, so this mode pins no layer:
    // the palette below carries the characters and labels each with the code
    // CHR$ takes, which is how the machine itself reached them.
    { id: 'graphic', name: 'GRAPHICS', layer: 'base', palette: 'graphics' },
  ],
  modifiers: [{ id: 'shift', emits: ['Shift'], sticky: true, lockable: true }],
  rows,
  graphicsPalette: {
    sections: [
      { title: 'Mosaics', entries: CPC_MOSAIC_GRAPHICS },
      { title: 'Lines', entries: CPC_LINE_GRAPHICS },
      { title: 'Shades and diagonals', entries: CPC_SHADE_GRAPHICS },
    ],
  },
  functionKeys,
  controllerKeys,
  glyphs: {},
  options: { minHoldFrames: 4 },
  // CPC keyboard-joystick: the cursor cluster steers, SPACE / ENTER fire.
  // The cursor keys are the non-rendered `controllerKeys` above (surfaced to the
  // typist as the CURSOR overlay on WASD); the real hardware joystick (matrix
  // line 9 via setJoystick, `native` mode) is a separate path.
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
};
