import type { KeyDef, KeyboardLayout } from '../../keyboard/layoutSchema';
import {
  type Legend,
  act,
  cursorKey,
  key as kitKey,
} from '../../keyboard/legendKit';
import { bottomRow } from '../../keyboard/templateRows';
import { TRS80_GRAPHICS } from './graphics';

/**
 * The TRS-80 keyboard on the standard virtual-keyboard template. The
 * TRS-80 is a plain QWERTY with SHIFT - no keyword or graphics typing layers -
 * so there are two character layers: base and SHIFT. Each key `emits` the
 * DOM-`code`-style token the interpreter's input adapter understands
 * (`interpreter/input.ts`), and the SHIFT legends double as editor inserts for
 * the symbols and operators that ride the shifted number/letter keys.
 *
 * A third `cursor` layer (pinned by the CURSOR mode tab, bottom-right on the
 * keycap since SHIFT already sits top-right) overlays `↑ ← ↓ →` on the W/A/S/D
 * keys, moving the editor caret - the same concept as the CPC 464 sibling.
 * Non-WASD keys keep typing normally in CURSOR mode via the base-layer fallback.
 */

/**
 * A key: base legend, the SHIFT legend where the keycap carries one, and the
 * CURSOR arrow the four WASD keys carry. Label tuple order matches `layers`
 * below: [base, shift, cursor].
 */
const key = (
  token: string,
  main: string,
  shift: Legend = null,
  cursor: Legend = null,
): KeyDef => kitKey(token, [main, shift, cursor]);

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
  key('KeyW', 'W', null, cursorKey('↑', 'up', 'ArrowUp')),
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
  key('KeyA', 'A', '+', cursorKey('←', 'left', 'ArrowLeft')),
  key('KeyS', 'S', '-', cursorKey('↓', 'down', 'ArrowDown')),
  key('KeyD', 'D', '*', cursorKey('→', 'right', 'ArrowRight')),
  key('KeyF', 'F', '/'),
  key('KeyG', 'G', '='),
  key('KeyH', 'H', ':'),
  key('KeyJ', 'J', ';'),
  key('KeyK', 'K', '@'),
  key('KeyL', 'L'),
  kitKey('Enter', [act('↵', 'newline'), null, null]),
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
  labels: [{ text: '⇧' }, null, null],
};

const spaceKey = {
  id: 'Space',
  emits: ['Space'],
  style: 'small-main',
  labels: [{ text: '␣', editor: { insert: ' ' } }, null, null],
} satisfies Omit<KeyDef, 'spanX'>;

// " is SHIFT-2.
const quoteKey = kitKey('Quote', ['"', null, null], {
  emits: ['Shift', 'Digit2'],
});

const breakKey = kitKey('Break', ['BRK', null, null]);

/**
 * The Model I has no backspace and no delete key: `←` is its destructive
 * backspace, sending 0x08, which the screen driver reads as "backspace and
 * erase". So the keycap carries the machine's own legend, and the editor action
 * matches what the machine does with it - move back one and erase. CURSOR mode
 * reaches the same cell, and the other three arrows besides; this cap is here
 * for the reach.
 */
const leftArrowKey = kitKey('Backspace', [act('←', 'backspace'), null, null], {
  emits: ['ArrowLeft'],
});

const rows: KeyDef[][] = [
  numberRow,
  qwertyRow,
  homeRow,
  zxcvRow,
  bottomRow([shiftKey], spaceKey, [quoteKey, breakKey, leftArrowKey]),
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
    {
      id: 'cursor',
      name: 'CURSOR',
      position: 'br',
      activeWhen: [],
    },
  ],
  editorModes: [
    { id: 'abc', name: 'ABC', layer: 'base' },
    { id: 'cursor', name: 'CURSOR', layer: 'cursor' },
    // The TRS-80 prints no graphics on its keycaps, so this mode pins no layer:
    // the palette below carries the characters and labels each with the code
    // CHR$ takes, which is how the machine itself reached them.
    { id: 'graphic', name: 'GRAPHICS', layer: 'base', palette: 'graphics' },
  ],
  modifiers: [{ id: 'shift', emits: ['Shift'], sticky: true, lockable: true }],
  rows,
  graphicsPalette: { sections: [{ entries: TRS80_GRAPHICS }] },
  glyphs: {},
  options: { minHoldFrames: 1 },
  // WASD movement + Space/Enter fire (the convention the bundled TRS-80 games use).
  controller: {
    bindings: {
      up: 'KeyW',
      down: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      fire1: 'Space',
      fire2: 'Enter',
    },
  },
};
