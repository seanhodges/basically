import type {
  EditorKeyAction,
  GlyphRegistry,
  KeyDef,
  KeyLabel,
  KeyboardLayout,
} from '../../keyboard/layoutSchema';
import { QUAD, chequer, glyph } from '../../keyboard/sinclairGlyphs';
import { bottomRow, centerRow } from '../../keyboard/templateRows';

/**
 * The Sinclair ZX80 keyboard on the standard virtual-keyboard template.
 *
 * The ZX80 shares the ZX81's 8×5 matrix (so the machine key tokens — `emits` —
 * are identical) but has fewer legends. Each alphanumeric key carries up to
 * four:
 *  - main:     the letter / digit
 *  - shift:    the symbol/operator typed with SHIFT held
 *  - keyword:  the white K-mode command (pinned by the KEYWORD mode tab)
 *  - graphic:  the block-graphics glyph (pinned by the GRAPHICS mode tab)
 *
 * The ZX80 has no FUNCTION cursor mode, so there is no function layer. As with
 * the rest of the template the dedicated cursor/HOME/RUBOUT keys are dropped and
 * a quote + backspace key live on the common bottom row.
 */

const zx80Glyphs: GlyphRegistry = {
  quadTL: glyph(QUAD.tl),
  quadTR: glyph(QUAD.tr),
  quadBL: glyph(QUAD.bl),
  quadBR: glyph(QUAD.br),
  halfT: glyph('M0 0H16V8H0Z'),
  halfB: glyph('M0 8H16V16H0Z'),
  halfL: glyph('M0 0H8V16H0Z'),
  halfR: glyph('M8 0H16V16H8Z'),
  solid: glyph('M0 0H16V16H0Z'),
  q3NoTL: glyph(QUAD.tr + QUAD.bl + QUAD.br),
  q3NoTR: glyph(QUAD.tl + QUAD.bl + QUAD.br),
  q3NoBL: glyph(QUAD.tl + QUAD.tr + QUAD.br),
  q3NoBR: glyph(QUAD.tl + QUAD.tr + QUAD.bl),
  diagTLBR: glyph(QUAD.tl + QUAD.br),
  diagTRBL: glyph(QUAD.tr + QUAD.bl),
  grey: glyph(chequer(0, 0, 16, 16)),
  greyInv: glyph(chequer(0, 0, 16, 16, 1)),
  greyT: glyph(chequer(0, 0, 16, 8)),
  greyB: glyph(chequer(0, 8, 16, 8)),
  greyTInv: glyph(chequer(0, 0, 16, 8, 1)),
  greyBInv: glyph(chequer(0, 8, 16, 8, 1)),
};

const GRAPHIC_INSERT: Record<string, string> = {
  quadTL: '▘',
  quadTR: '▝',
  quadBL: '▖',
  quadBR: '▗',
  halfT: '▀',
  halfB: '▄',
  halfL: '▌',
  halfR: '▐',
  solid: '█',
  q3NoTL: '▟',
  q3NoTR: '▙',
  q3NoBL: '▜',
  q3NoBR: '▛',
  diagTLBR: '▚',
  diagTRBL: '▞',
  grey: '▒',
  greyInv: '\\||',
  greyT: "\\!'",
  greyB: '\\!.',
  greyTInv: "\\|'",
  greyBInv: '\\|.',
};

// Label tuple order matches `layers` below: [main, shift, keyword, graphic].
type Legend = string | { text: string; editor: EditorKeyAction | null } | null;

const word = (text: string): Legend => ({
  text,
  editor: { insert: `${text} ` },
});
const act = (
  text: string,
  action: 'backspace' | 'newline' | 'left' | 'right' | 'up' | 'down',
): Legend => ({ text, editor: { action } });
const ins = (text: string, insert: string): Legend => ({
  text,
  editor: { insert },
});

type Legends = [Legend, Legend, Legend, string | null];

const lbl = (legend: Legend): KeyLabel | null =>
  legend === null
    ? null
    : typeof legend === 'string'
      ? { text: legend }
      : { text: legend.text, editor: legend.editor };

function key(token: string, [main, shift, keyword, graphic]: Legends): KeyDef {
  const glyphInsert = graphic === null ? undefined : GRAPHIC_INSERT[graphic];
  return {
    id: token,
    spanX: 4,
    emits: [token],
    labels: [
      lbl(main),
      lbl(shift),
      lbl(keyword),
      graphic === null
        ? null
        : {
            glyph: graphic,
            editor: glyphInsert === undefined ? null : { insert: glyphInsert },
          },
    ],
  };
}

const numberRow = [
  key('Digit1', ['1', word('NOT'), null, 'quadTL']),
  key('Digit2', ['2', word('AND'), null, 'quadTR']),
  key('Digit3', ['3', word('THEN'), null, 'quadBR']),
  key('Digit4', ['4', word('TO'), null, 'quadBL']),
  key('Digit5', ['5', { text: '←', editor: null }, null, 'halfL']),
  key('Digit6', ['6', { text: '↓', editor: null }, null, 'halfB']),
  key('Digit7', ['7', { text: '↑', editor: null }, null, 'halfT']),
  key('Digit8', ['8', { text: '→', editor: null }, null, 'halfR']),
  key('Digit9', ['9', null, null, null]),
  key('Digit0', ['0', null, null, null]),
];

const qwertyRow = [
  key('KeyQ', ['Q', null, 'NEW', 'q3NoTL']),
  key('KeyW', ['W', null, 'LOAD', 'q3NoTR']),
  key('KeyE', ['E', null, 'SAVE', 'q3NoBR']),
  key('KeyR', ['R', null, 'RUN', 'q3NoBL']),
  key('KeyT', ['T', null, 'CONTINUE', 'diagTRBL']),
  key('KeyY', ['Y', '"', 'REM', 'diagTLBR']),
  key('KeyU', ['U', '$', 'IF', null]),
  key('KeyI', ['I', '(', 'INPUT', null]),
  key('KeyO', ['O', ')', 'PRINT', null]),
  key('KeyP', ['P', '*', null, null]),
];

const homeRow = [
  key('KeyA', ['A', null, 'LIST', 'grey']),
  key('KeyS', ['S', null, 'STOP', 'greyT']),
  key('KeyD', ['D', null, 'DIM', 'greyB']),
  key('KeyF', ['F', null, 'FOR', 'greyTInv']),
  key('KeyG', ['G', null, 'GOTO', 'greyBInv']),
  key('KeyH', ['H', '**', 'POKE', 'greyInv']),
  // '−' is U+2212 (not in the ZX80 charset); insert the ASCII hyphen.
  key('KeyJ', ['J', ins('−', '-'), 'RANDOMISE', null]),
  key('KeyK', ['K', '+', 'LET', null]),
  key('KeyL', ['L', '=', null, null]),
  key('Enter', [act('↵', 'newline'), null, null, null]),
];

const zxcvRow = centerRow([
  key('KeyZ', ['Z', ':', null, null]),
  key('KeyX', ['X', ';', 'CLEAR', null]),
  key('KeyC', ['C', '?', 'CLS', null]),
  key('KeyV', ['V', '/', 'GOSUB', null]),
  key('KeyB', ['B', word('OR'), 'RETURN', null]),
  key('KeyN', ['N', '<', 'NEXT', null]),
  key('KeyM', ['M', '>', null, null]),
  key('Period', ['.', ',', null, null]),
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
  labels: [
    { text: '␣', editor: { insert: ' ' } },
    { text: '£' },
    null,
    { glyph: 'solid', editor: { insert: '█' } },
  ],
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
    { id: 'graphic', name: 'GRAPHICS', position: 'br', activeWhen: [] },
  ],
  editorModes: [
    { id: 'abc', name: 'ABC', layer: 'main' },
    { id: 'keyword', name: 'KEYWORD', layer: 'keyword' },
    { id: 'graphic', name: 'GRAPHICS', layer: 'graphic' },
  ],
  modifiers: [{ id: 'shift', emits: ['Shift'], sticky: true, lockable: true }],
  rows,
  glyphs: zx80Glyphs,
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
