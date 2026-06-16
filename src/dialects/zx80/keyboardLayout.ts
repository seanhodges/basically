import type {
  EditorKeyAction,
  GlyphRegistry,
  KeyDef,
  KeyLabel,
  KeyboardLayout,
} from '../../keyboard/layoutSchema';
import { QUAD, chequer, glyph } from '../../keyboard/sinclairGlyphs';

/**
 * The Sinclair ZX80 membrane keyboard as virtual-keyboard layout data.
 *
 * The ZX80 shares the ZX81's 8×5 matrix (so the machine key tokens — `emits` —
 * are identical), but its legends differ. Each key carries up to four legends,
 * matching the real faceplate and what the emulated machine produces:
 *  - main:     the letter / digit
 *  - shift:    the symbol typed with SHIFT held (operators are ZX80 tokens, plus
 *              the cursor arrows / HOME / RUBOUT on the number row)
 *  - keyword:  the white K-mode command printed on the key
 *  - graphic:  the block-graphics glyph in the bottom-right corner
 *
 * The ZX80 has no FUNCTION cursor mode like the ZX81 — its "integral functions"
 * (CHR$, PEEK, USR, …) are typed letter-by-letter and are intentionally not key
 * legends — so there is no function layer. Graphics are offered as a GRAPHICS
 * editor mode (the glyph each key inserts is a ZX80 charset block character).
 */

// ---------------------------------------------------------------------------
// Block-graphics glyphs. 16×16 viewBox, 2×2 quadrants of 8px; grey areas are a
// 2px chequerboard. The QUAD/chequer/glyph builders are shared with the ZX81
// (see ../../keyboard/sinclairGlyphs); the ZX80 has fewer grey variants and
// none of the ZX81's half-solid/half-grey combos.

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

// ---------------------------------------------------------------------------
// What each block-graphics glyph inserts as editor text: the charset's unicode
// block elements, or backslash escapes for the chequered greys (see charset.ts
// GRAPHIC_UNICODE / ESCAPES — the escape spellings differ from the ZX81's).

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

// ---------------------------------------------------------------------------
// Key data. Label tuple order matches `layers` below: [main, shift, keyword,
// graphic]. A text legend is a plain string (editor action derived from the
// layer's editorInsertStyle) or an object overriding what it does in the editor.

type Legend = string | { text: string; editor: EditorKeyAction | null } | null;

/** Legend that inserts the keyword/operator plus a trailing space. */
const word = (text: string): Legend => ({
  text,
  editor: { insert: `${text} ` },
});
/** Legend bound to an editing action (backspace, cursor moves, newline). */
const act = (
  text: string,
  action: 'backspace' | 'newline' | 'left' | 'right' | 'up' | 'down',
): Legend => ({ text, editor: { action } });
/** Legend that inserts different text than it shows. */
const ins = (text: string, insert: string): Legend => ({
  text,
  editor: { insert },
});
/** Legend that does nothing in the editor (machine-only commands). */
const noop = (text: string): Legend => ({ text, editor: null });

type Legends = [Legend, Legend, Legend, string | null];

function key(token: string, [main, shift, keyword, graphic]: Legends): KeyDef {
  const lbl = (legend: Legend): KeyLabel | null =>
    legend === null
      ? null
      : typeof legend === 'string'
        ? { text: legend }
        : { text: legend.text, editor: legend.editor };
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

const rows: KeyDef[][] = [
  [
    key('Digit1', ['1', word('NOT'), null, 'quadTL']),
    key('Digit2', ['2', word('AND'), null, 'quadTR']),
    key('Digit3', ['3', word('THEN'), null, 'quadBR']),
    key('Digit4', ['4', word('TO'), null, 'quadBL']),
    key('Digit5', ['5', act('←', 'left'), null, 'halfL']),
    key('Digit6', ['6', act('↓', 'down'), null, 'halfB']),
    key('Digit7', ['7', act('↑', 'up'), null, 'halfT']),
    key('Digit8', ['8', act('→', 'right'), null, 'halfR']),
    key('Digit9', ['9', noop('HOME'), null, null]),
    key('Digit0', ['0', act('⌫', 'backspace'), null, null]),
  ],
  [
    key('KeyQ', ['Q', null, 'NEW', 'q3NoTL']),
    key('KeyW', ['W', null, 'LOAD', 'q3NoTR']),
    key('KeyE', ['E', null, 'SAVE', 'q3NoBR']),
    key('KeyR', ['R', null, 'RUN', 'q3NoBL']),
    key('KeyT', ['T', null, 'CONTINUE', 'diagTRBL']),
    key('KeyY', ['Y', null, 'REM', 'diagTLBR']),
    key('KeyU', ['U', null, 'IF', null]),
    key('KeyI', ['I', '(', 'INPUT', null]),
    key('KeyO', ['O', ')', 'PRINT', null]),
    key('KeyP', ['P', '*', null, null]),
  ],
  [
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
    {
      ...key('Enter', [act('↵', 'newline'), null, null, null]),
    },
  ],
  [
    {
      id: 'Shift',
      spanX: 4,
      emits: ['Shift'],
      modifier: 'shift',
      style: 'shift',
      labels: [{ text: '⇧' }, null, null, null],
    },
    key('KeyZ', ['Z', ':', null, null]),
    key('KeyX', ['X', ';', 'CLEAR', null]),
    key('KeyC', ['C', '?', 'CLS', null]),
    key('KeyV', ['V', '/', 'GOSUB', null]),
    key('KeyB', ['B', word('OR'), 'RETURN', null]),
    key('KeyN', ['N', '<', 'NEXT', null]),
    key('KeyM', ['M', '>', null, null]),
    key('Period', ['.', ',', null, null]),
    {
      ...key('Space', [ins('SPACE', ' '), '£', null, 'solid']),
      style: 'small-main',
    },
  ],
  // Convenience extras (not on the real machine): common shift chords as single
  // keys, handy on touch screens. The ZX80 has no EDIT key (its SHIFT+1 is NOT).
  [
    {
      id: 'x-left',
      spanX: 8,
      emits: ['Shift', 'Digit5'],
      style: 'extra',
      labels: [{ text: '←', editor: { action: 'left' } }, null, null, null],
    },
    {
      id: 'x-down',
      spanX: 8,
      emits: ['Shift', 'Digit6'],
      style: 'extra',
      labels: [{ text: '↓', editor: { action: 'down' } }, null, null, null],
    },
    {
      id: 'x-up',
      spanX: 8,
      emits: ['Shift', 'Digit7'],
      style: 'extra',
      labels: [{ text: '↑', editor: { action: 'up' } }, null, null, null],
    },
    {
      id: 'x-right',
      spanX: 8,
      emits: ['Shift', 'Digit8'],
      style: 'extra',
      labels: [{ text: '→', editor: { action: 'right' } }, null, null, null],
    },
    {
      id: 'x-rubout',
      spanX: 8,
      emits: ['Shift', 'Digit0'],
      style: 'extra',
      labels: [
        { text: '⌫', editor: { action: 'backspace' } },
        null,
        null,
        null,
      ],
    },
  ],
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
};
