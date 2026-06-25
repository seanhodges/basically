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
 * The ZX81 keyboard on the standard virtual-keyboard template: a uniform
 * ten-key grid (number row, three QWERTY rows, a common bottom row) with the
 * machine's modes offered as top-strip tabs.
 *
 * Each alphanumeric key still carries the authentic ZX81 legends:
 *  - main:     the big white character
 *  - shift:    the red symbol in the top-right corner (SHIFT held)
 *  - keyword:  the white K-mode keyword (pinned by the KEYWORD mode tab)
 *  - function: the red FUNCTION-mode name (pinned by the FUNCTION mode tab)
 *  - graphic:  the block-graphics glyph (pinned by the GRAPHICS mode tab)
 *
 * Per the template, the dedicated cursor/EDIT/RUBOUT keys and the number-row
 * arrow legends are dropped (the editor handles cursor placement by touch); a
 * single quote and backspace key live on the common bottom row instead.
 */

const zx81Glyphs: GlyphRegistry = {
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
  greyTSolidB: glyph(chequer(0, 0, 16, 8) + 'M0 8H16V16H0Z'),
  solidTGreyB: glyph('M0 0H16V8H0Z' + chequer(0, 8, 16, 8)),
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
  greyTSolidB: "\\|'",
  solidTGreyB: '\\|.',
};

// Label tuple order matches `layers` below: [main, shift, keyword, function,
// graphic].
type Legend = string | { text: string; editor: EditorKeyAction | null } | null;

/** Legend that inserts the keyword plus a trailing space. */
const word = (text: string): Legend => ({
  text,
  editor: { insert: `${text} ` },
});
/** Legend bound to an editing action (backspace, newline). */
const act = (
  text: string,
  action: 'backspace' | 'newline' | 'left' | 'right' | 'up' | 'down',
): Legend => ({ text, editor: { action } });
/** Legend that inserts different text than it shows. */
const ins = (text: string, insert: string): Legend => ({
  text,
  editor: { insert },
});

type Legends = [Legend, Legend, Legend, Legend, string | null];

const lbl = (legend: Legend): KeyLabel | null =>
  legend === null
    ? null
    : typeof legend === 'string'
      ? { text: legend }
      : { text: legend.text, editor: legend.editor };

function key(
  token: string,
  [main, shift, keyword, fn, graphic]: Legends,
): KeyDef {
  const glyphInsert = graphic === null ? undefined : GRAPHIC_INSERT[graphic];
  return {
    id: token,
    spanX: 4,
    emits: [token],
    labels: [
      lbl(main),
      lbl(shift),
      lbl(keyword),
      lbl(fn),
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
  key('Digit1', ['1', null, null, null, 'quadTL']),
  key('Digit2', ['2', word('AND'), null, null, 'quadTR']),
  key('Digit3', ['3', word('THEN'), null, null, 'quadBR']),
  key('Digit4', ['4', word('TO'), null, null, 'quadBL']),
  key('Digit5', ['5', { text: '←', editor: null }, null, null, 'halfL']),
  key('Digit6', ['6', { text: '↓', editor: null }, null, null, 'halfB']),
  key('Digit7', ['7', { text: '↑', editor: null }, null, null, 'halfT']),
  key('Digit8', ['8', { text: '→', editor: null }, null, null, 'halfR']),
  key('Digit9', ['9', null, null, null, null]),
  key('Digit0', ['0', null, null, null, null]),
];

const qwertyRow = [
  key('KeyQ', ['Q', '""', 'PLOT', 'SIN', 'q3NoTL']),
  key('KeyW', ['W', word('OR'), 'UNPLOT', 'COS', 'q3NoTR']),
  key('KeyE', ['E', word('STEP'), 'REM', 'TAN', 'q3NoBR']),
  key('KeyR', ['R', '<=', 'RUN', 'INT', 'q3NoBL']),
  key('KeyT', ['T', '<>', 'RAND', 'RND', 'diagTRBL']),
  key('KeyY', ['Y', '>=', 'RETURN', 'STR$', 'diagTLBR']),
  key('KeyU', ['U', '$', 'IF', 'CHR$', null]),
  key('KeyI', ['I', '(', 'INPUT', 'CODE', null]),
  key('KeyO', ['O', ')', 'POKE', 'PEEK', null]),
  key('KeyP', ['P', '"', 'PRINT', 'TAB', null]),
];

const homeRow = [
  key('KeyA', ['A', word('STOP'), 'NEW', 'ARCSIN', 'grey']),
  key('KeyS', ['S', word('LPRINT'), 'SAVE', 'ARCCOS', 'greyT']),
  key('KeyD', ['D', word('SLOW'), 'DIM', 'ARCTAN', 'greyB']),
  key('KeyF', ['F', word('FAST'), 'FOR', 'SGN', 'greyTSolidB']),
  key('KeyG', ['G', word('LLIST'), 'GOTO', 'ABS', 'solidTGreyB']),
  key('KeyH', ['H', '**', 'GOSUB', 'SQR', 'greyInv']),
  // '−' is U+2212 (not in the ZX81 charset); insert the ASCII hyphen.
  key('KeyJ', ['J', ins('−', '-'), 'LOAD', 'VAL', null]),
  key('KeyK', ['K', '+', 'LIST', 'LEN', null]),
  key('KeyL', ['L', '=', 'LET', 'USR', null]),
  key('Enter', [act('↵', 'newline'), null, null, null, null]),
];

const zxcvRow = centerRow([
  key('KeyZ', ['Z', ':', 'COPY', 'LN', null]),
  key('KeyX', ['X', ';', 'CLEAR', 'EXP', null]),
  key('KeyC', ['C', '?', 'CONT', 'AT', null]),
  key('KeyV', ['V', '/', 'CLS', null, null]),
  key('KeyB', ['B', '*', 'SCROLL', 'INKEY$', null]),
  key('KeyN', ['N', '<', 'NEXT', 'NOT', null]),
  key('KeyM', ['M', '>', 'PAUSE', 'PI', null]),
  key('Period', ['.', ',', null, null, null]),
]);

const shiftKey: KeyDef = {
  id: 'Shift',
  spanX: 6,
  emits: ['Shift'],
  modifier: 'shift',
  style: 'shift',
  labels: [{ text: '⇧' }, null, null, null, null],
};

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [
    { text: 'SPACE', editor: { insert: ' ' } },
    { text: '£' },
    null,
    null,
    { glyph: 'solid', editor: { insert: '█' } },
  ],
} satisfies Omit<KeyDef, 'spanX'>;

const quoteKey: KeyDef = {
  id: 'Quote',
  spanX: 4,
  emits: ['Shift', 'KeyP'],
  labels: [{ text: '"' }, null, null, null, null],
};

const backspaceKey: KeyDef = {
  id: 'Backspace',
  spanX: 4,
  emits: ['Shift', 'Digit0'],
  labels: [
    { text: '⌫', editor: { action: 'backspace' } },
    null,
    null,
    null,
    null,
  ],
};

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRow([shiftKey], spaceKey, [quoteKey, backspaceKey]),
];

export const zx81KeyboardLayout: KeyboardLayout = {
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
    { id: 'graphic', name: 'GRAPHICS', position: 'br', activeWhen: [] },
  ],
  editorModes: [
    { id: 'abc', name: 'ABC', layer: 'main' },
    { id: 'keyword', name: 'KEYWORD', layer: 'keyword' },
    { id: 'function', name: 'FUNCTION', layer: 'function' },
    { id: 'graphic', name: 'GRAPHICS', layer: 'graphic' },
  ],
  modifiers: [{ id: 'shift', emits: ['Shift'], sticky: true, lockable: true }],
  rows,
  glyphs: zx81Glyphs,
  options: { minHoldFrames: 3, compactDefaultLayer: 'keyword' },
};
