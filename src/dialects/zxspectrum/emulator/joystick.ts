import type { JoystickState } from '../../types';

/** A keyboard sink that can press/release matrix keys by DOM-code token. */
interface KeySink {
  setKey(token: string, down: boolean): void;
}

/**
 * Drive the Sinclair interface's joystick 1, which is hard-wired to the keyboard
 * matrix: 1 = left, 2 = right, 3 = down, 4 = up, 5 = fire. Pushing a direction
 * is exactly holding that number key, so this just mirrors the state onto keys
 * 1–5 (both fire buttons share key 5).
 */
export function applySinclairJoystick(
  keyboard: KeySink,
  state: JoystickState,
): void {
  keyboard.setKey('Digit1', state.left);
  keyboard.setKey('Digit2', state.right);
  keyboard.setKey('Digit3', state.down);
  keyboard.setKey('Digit4', state.up);
  keyboard.setKey('Digit5', state.fire1 || state.fire2);
}

/**
 * Build a Kempston port byte: active-high (a closed switch sets its bit),
 * bit0 = right, 1 = left, 2 = down, 3 = up, 4 = fire; idle = 0x00. The port is
 * single-fire, so `fire2` folds into the one fire bit.
 */
export function kempstonByte(state: JoystickState): number {
  let value = 0;
  if (state.right) value |= 0x01;
  if (state.left) value |= 0x02;
  if (state.down) value |= 0x04;
  if (state.up) value |= 0x08;
  if (state.fire1 || state.fire2) value |= 0x10;
  return value;
}
