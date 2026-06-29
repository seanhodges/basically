import type { KeyDef, KeyboardLayout } from '../../keyboard/layoutSchema';
import { bottomRow } from '../../keyboard/templateRows';

/**
 * The TRS-80 keyboard on the standard virtual-keyboard template. The
 * TRS-80 is a plain QWERTY with SHIFT — no keyword or graphics typing layers —
 * so there are just two legend layers: base and SHIFT. Each key `emits` the
 * DOM-`code`-style token the interpreter's input adapter understands
 * (`interpreter/input.ts`), and the SHIFT legends double as editor inserts for
 * the symbols and operators that ride the shifted number/letter keys.
 */

type Shift = string | { text: string; insert: string };

function key(token: string, main: string, shift?: Shift): KeyDef {
  const shiftLabel =
    shift === undefined
      ? null
      : typeof shift === 'string'
        ? { text: shift }
        : { text: shift.text, editor: { insert: shift.insert } as const };
  return {
    id: token,
    spanX: 4,
    emits: [token],
    labels: [{ text: main }, shiftLabel],
  };
}

// Shifted number keys (US TRS-80): matches input.ts SHIFTED_DIGIT.
const numberRow = [
  key('Digit1', '1', '!'),
  key('Digit2', '2', '"'),
  key('Digit3', '3', '#'),
  key('Digit4', '4', '$'),
  key('Digit5', '5', '%'),
  key('Digit6', '6', '&'),
  key('Digit7', '7', "'"),
  key('Digit8', '8', '('),
  key('Digit9', '9', ')'),
  key('Digit0', '0'),
];

const qwertyRow = [
  key('KeyQ', 'Q'),
  key('KeyW', 'W'),
  key('KeyE', 'E'),
  key('KeyR', 'R'),
  key('KeyT', 'T'),
  key('KeyY', 'Y'),
  key('KeyU', 'U'),
  key('KeyI', 'I'),
  key('KeyO', 'O'),
  key('KeyP', 'P'),
];

// SHIFT legends on the home row expose the common operators as editor inserts.
const homeRow = [
  key('KeyA', 'A', '+'),
  key('KeyS', 'S', '-'),
  key('KeyD', 'D', '*'),
  key('KeyF', 'F', '/'),
  key('KeyG', 'G', '='),
  key('KeyH', 'H', ':'),
  key('KeyJ', 'J', ';'),
  key('KeyK', 'K', '@'),
  key('KeyL', 'L'),
  {
    id: 'Enter',
    spanX: 4,
    emits: ['Enter'],
    labels: [{ text: '↵', editor: { action: 'newline' } }, null],
  } satisfies KeyDef,
];

const zxcvRow = [
  key('KeyZ', 'Z'),
  key('KeyX', 'X'),
  key('KeyC', 'C'),
  key('KeyV', 'V'),
  key('KeyB', 'B'),
  key('KeyN', 'N'),
  key('KeyM', 'M'),
  key('Comma', ',', '<'),
  key('Period', '.', '>'),
  key('Slash', '/', '?'),
];

const shiftKey: KeyDef = {
  id: 'Shift',
  spanX: 6,
  emits: ['Shift'],
  modifier: 'shift',
  style: 'shift',
  labels: [{ text: '⇧' }, null],
};

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: '␣', editor: { insert: ' ' } }, null],
} satisfies Omit<KeyDef, 'spanX'>;

const quoteKey: KeyDef = {
  id: 'Quote',
  spanX: 4,
  emits: ['Shift', 'Digit2'], // " is SHIFT-2
  labels: [{ text: '"' }, null],
};

const breakKey: KeyDef = {
  id: 'Break',
  spanX: 4,
  emits: ['Break'],
  labels: [{ text: 'BRK' }, null],
};

const backspaceKey: KeyDef = {
  id: 'Backspace',
  spanX: 4,
  emits: ['ArrowLeft'], // the Model I backspaces with the left arrow
  labels: [{ text: '⌫', editor: { action: 'backspace' } }, null],
};

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRow([shiftKey], spaceKey, [quoteKey, breakKey, backspaceKey]),
];

export const trs80KeyboardLayout: KeyboardLayout = {
  id: 'trs80',
  name: 'TRS-80',
  theme: 'vk-theme-trs80',
  gridColumns: 40,
  layers: [
    {
      id: 'base',
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
  ],
  modifiers: [{ id: 'shift', emits: ['Shift'], sticky: true, lockable: true }],
  rows,
  glyphs: {},
  options: { minHoldFrames: 1 },
  // WASD movement + Space fire (the convention the bundled TRS-80 games use).
  controller: {
    bindings: {
      up: 'KeyW',
      down: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      fire1: 'Space',
    },
  },
};
