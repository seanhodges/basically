import { ATOM, stringToATOMKeys } from 'jsbeeb/src/utils_atom.js';
import type { AtomPPIA } from 'jsbeeb/src/ppia.js';

/**
 * Acorn Atom key matrix glue for the jsbeeb core.
 *
 * The Atom scans its keyboard through an 8255 PPIA (`AtomPPIA`), not the BBC's
 * SysVia, so this is a sibling of `src/emulator/bbc/keyboard.ts` rather than a
 * reuse of it. Matrix positions come from jsbeeb's `utils_atom.js` `ATOM`
 * table — each entry is a `[row, col]` pair indexing `AtomPPIA.keys`.
 */

/** One Atom key-matrix position: `[portA row select, portB column bit]`. */
export type AtomMatrixPos = readonly [number, number];

/**
 * Virtual-keyboard tokens → Atom matrix positions. Tokens follow the
 * DOM-code-style convention the other dialects use ('KeyA', 'Digit1', 'Enter'…)
 * plus a few Atom-specific keys. 'Break' is intentionally absent: it is the CPU
 * reset line, not a matrix key, and is handled by AtomMachine.setKey directly.
 */
const TOKEN_TO_MATRIX: Record<string, AtomMatrixPos> = (() => {
  const map: Record<string, AtomMatrixPos> = {
    Enter: ATOM.RETURN,
    Space: ATOM.SPACE,
    Escape: ATOM.ESCAPE,
    Delete: ATOM.DELETE,
    Copy: ATOM.COPY,
    Shift: ATOM.SHIFT,
    Ctrl: ATOM.CTRL,
    Rept: ATOM.REPT,
    Lock: ATOM.LOCK,
    ArrowLeft: ATOM.LEFT,
    ArrowRight: ATOM.LEFT_RIGHT,
    ArrowUp: ATOM.UP,
    ArrowDown: ATOM.DOWN,
    UpArrow: ATOM.UP_ARROW,
    Minus: ATOM.MINUS_EQUALS,
    Semicolon: ATOM.SEMICOLON_PLUS,
    Colon: ATOM.COLON_STAR,
    Comma: ATOM.COMMA_LESSTHAN,
    Period: ATOM.PERIOD_GREATERTHAN,
    Slash: ATOM.SLASH_QUESTIONMARK,
    At: ATOM.AT,
    BracketLeft: ATOM.LEFT_SQUARE_BRACKET,
    BracketRight: ATOM.RIGHT_SQUARE_BRACKET,
    Backslash: ATOM.BACKSLASH,
  };
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    map[`Key${letter}`] = ATOM[letter as keyof typeof ATOM] as AtomMatrixPos;
  }
  for (let d = 0; d <= 9; d++) {
    map[`Digit${d}`] = ATOM[`K${d}` as keyof typeof ATOM] as AtomMatrixPos;
  }
  return map;
})();

export function matrixForToken(token: string): AtomMatrixPos | undefined {
  return TOKEN_TO_MATRIX[token];
}

/**
 * Expand a short ASCII string (e.g. `"RUN\r"`) into the sequence of matrix
 * presses needed to type it, including the SHIFT / caps-LOCK toggles the Atom
 * ROM expects. SHIFT and LOCK are returned as toggle keys (each occurrence
 * flips the held state); every other entry is a momentary press. Delegates the
 * character → key logic to jsbeeb's own `stringToATOMKeys` so it stays in step
 * with the core.
 */
export function stringToMatrix(text: string): readonly AtomMatrixPos[] {
  // jsbeeb's helper keys off '\n' for RETURN; normalise '\r' to '\n'.
  return stringToATOMKeys(text.replace(/\r/g, '\n'));
}

/** True when a matrix position is the SHIFT or caps-LOCK toggle key. */
export function isToggleKey(pos: AtomMatrixPos): boolean {
  return (
    (pos[0] === ATOM.SHIFT[0] && pos[1] === ATOM.SHIFT[1]) ||
    (pos[0] === ATOM.LOCK[0] && pos[1] === ATOM.LOCK[1])
  );
}

/**
 * Host keyboard → Atom PPIA. jsbeeb's Atom key map (`getKeyMapAtom`) is keyed
 * by legacy JS keyCodes and split by shift state, mirroring its own Keyboard
 * class. We resolve the event's keyCode and hand it to the PPIA, which looks up
 * the right matrix cell for the current shift state.
 */
export class AtomHostKeyboard {
  constructor(private readonly ppia: AtomPPIA) {
    ppia.setKeyLayout('natural');
  }

  /** Returns true when the event mapped to an Atom key and was consumed. */
  handleKey(e: KeyboardEvent, down: boolean): boolean {
    const code = e.which || e.keyCode;
    if (!code) return false;
    if (down) this.ppia.keyDown(code, e.shiftKey);
    else this.ppia.keyUp(code);
    return true;
  }
}
