import type {
  KeyDef,
  KeyLabel,
  KeyboardLayout,
} from '../../keyboard/layoutSchema';

/**
 * The Sinclair ZX80 membrane keyboard as virtual-keyboard layout data.
 *
 * The ZX80 shares the ZX81's 8×5 matrix (so the machine key tokens — `emits` —
 * are identical), but its legends differ. Each key here carries up to three
 * legends, matching what the real ROM produces and what was confirmed on the
 * emulated machine:
 *  - main:    the letter / digit
 *  - shift:   the symbol typed with SHIFT held (operators are ZX80 tokens)
 *  - keyword: the white K-mode command printed on the key
 *
 * The ZX80 has no FUNCTION/GRAPHICS cursor modes like the ZX81, so there are
 * just the base, shift and keyword layers.
 */

interface Legend {
  text: string;
  insert?: string;
  action?: 'backspace' | 'newline';
}
const main = (text: string): Legend => ({ text });
const sym = (text: string, insert = text): Legend => ({ text, insert });
const word = (text: string): Legend => ({ text, insert: `${text} ` });
const act = (text: string, action: 'backspace' | 'newline'): Legend => ({
  text,
  action,
});

type Triple = [Legend, Legend | null, Legend | null];

function key(token: string, [m, s, k]: Triple): KeyDef {
  const lbl = (lg: Legend | null, mode: 'char' | 'word'): KeyLabel | null => {
    if (lg === null) return null;
    if (lg.action) return { text: lg.text, editor: { action: lg.action } };
    if (lg.insert !== undefined && (lg.insert !== lg.text || mode === 'word'))
      return { text: lg.text, editor: { insert: lg.insert } };
    return { text: lg.text };
  };
  return {
    id: token,
    spanX: 4,
    emits: [token],
    labels: [lbl(m, 'char'), lbl(s, 'char'), lbl(k, 'word')],
  };
}

const rows: KeyDef[][] = [
  [
    key('Digit1', [main('1'), null, null]),
    key('Digit2', [main('2'), null, null]),
    key('Digit3', [main('3'), null, null]),
    key('Digit4', [main('4'), null, null]),
    key('Digit5', [main('5'), null, null]),
    key('Digit6', [main('6'), null, null]),
    key('Digit7', [main('7'), null, null]),
    key('Digit8', [main('8'), null, null]),
    key('Digit9', [main('9'), null, null]),
    key('Digit0', [main('0'), act('⌫', 'backspace'), null]),
  ],
  [
    key('KeyQ', [main('Q'), null, word('NEW')]),
    key('KeyW', [main('W'), null, word('LOAD')]),
    key('KeyE', [main('E'), null, word('SAVE')]),
    key('KeyR', [main('R'), null, word('RUN')]),
    key('KeyT', [main('T'), null, word('CONTINUE')]),
    key('KeyY', [main('Y'), null, word('REM')]),
    key('KeyU', [main('U'), null, word('IF')]),
    key('KeyI', [main('I'), sym('('), word('INPUT')]),
    key('KeyO', [main('O'), sym(')'), word('PRINT')]),
    key('KeyP', [main('P'), sym('*'), null]),
  ],
  [
    key('KeyA', [main('A'), null, word('LIST')]),
    key('KeyS', [main('S'), null, word('STOP')]),
    key('KeyD', [main('D'), null, word('DIM')]),
    key('KeyF', [main('F'), null, word('FOR')]),
    key('KeyG', [main('G'), null, word('GOTO')]),
    key('KeyH', [main('H'), sym('**'), word('POKE')]),
    key('KeyJ', [main('J'), sym('−', '-'), word('RANDOMISE')]),
    key('KeyK', [main('K'), sym('+'), word('LET')]),
    key('KeyL', [main('L'), sym('='), null]),
    {
      ...key('Enter', [act('↵', 'newline'), null, null]),
    },
  ],
  [
    {
      id: 'Shift',
      spanX: 4,
      emits: ['Shift'],
      modifier: 'shift',
      style: 'shift',
      labels: [{ text: '⇧' }, null, null],
    },
    key('KeyZ', [main('Z'), sym(':'), null]),
    key('KeyX', [main('X'), sym(';'), word('CLEAR')]),
    key('KeyC', [main('C'), null, word('CLS')]),
    key('KeyV', [main('V'), sym('/'), word('GOSUB')]),
    key('KeyB', [main('B'), word('OR'), word('RETURN')]),
    key('KeyN', [main('N'), sym('<'), word('NEXT')]),
    key('KeyM', [main('M'), sym('>'), null]),
    key('Period', [main('.'), sym(','), null]),
    {
      ...key('Space', [{ text: 'SPACE', insert: ' ' }, null, null]),
      style: 'small-main',
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
  ],
  editorModes: [
    { id: 'abc', name: 'ABC', layer: 'main' },
    { id: 'keyword', name: 'KEYWORD', layer: 'keyword' },
  ],
  modifiers: [{ id: 'shift', emits: ['Shift'], sticky: true, lockable: true }],
  rows,
  glyphs: {},
  options: { minHoldFrames: 3, compactDefaultLayer: 'keyword' },
};
