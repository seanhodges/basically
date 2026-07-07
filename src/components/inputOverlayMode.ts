/** The three positions of the input-overlay control, derived from the two
    independent intent flags. */
export type OverlayMode = 'off' | 'keyboard' | 'gamepad';

/**
 * Current mode from the two flags. The gamepad wins when both are set, which
 * also normalises any legacy both-on state (the button never writes it) to a
 * single well-defined position.
 */
export function overlayModeOf(
  keyboardEnabled: boolean,
  controllerEnabled: boolean,
): OverlayMode {
  if (controllerEnabled) return 'gamepad';
  if (keyboardEnabled) return 'keyboard';
  return 'off';
}

/** Full cycle order (gamepad in play): off → keyboard → gamepad → off. */
const NEXT_MODE: Record<OverlayMode, OverlayMode> = {
  off: 'keyboard',
  keyboard: 'gamepad',
  gamepad: 'off',
};

/** Two-way cycle (gamepad not a meaningful position): off/auto ↔ keyboard. */
const NEXT_MODE_NO_GAMEPAD: Record<OverlayMode, OverlayMode> = {
  off: 'keyboard',
  keyboard: 'off',
  // A stale gamepad state (enabled elsewhere) collapses straight to keyboard.
  gamepad: 'keyboard',
};

/**
 * The two intent flags a click writes, given the current mode. With the gamepad
 * in the cycle it's off → keyboard → gamepad → off; without it, a two-way
 * off/auto ↔ keyboard that never enables (and collapses any stale) gamepad.
 */
export function nextOverlayFlags(
  mode: OverlayMode,
  gamepadInCycle: boolean,
): { keyboardEnabled: boolean; controllerEnabled: boolean } {
  const next = (gamepadInCycle ? NEXT_MODE : NEXT_MODE_NO_GAMEPAD)[mode];
  return {
    controllerEnabled: next === 'gamepad',
    keyboardEnabled: next === 'keyboard',
  };
}

/** What the next click does, from each current mode (matches the user's labels). */
const NEXT_LABEL: Record<OverlayMode, string> = {
  off: 'Enable virtual keyboard',
  keyboard: 'Enable virtual gamepad',
  gamepad: 'Disable virtual keyboard and gamepad',
};

/** Labels for the two-way cycle, which never enables the gamepad. */
const NEXT_LABEL_NO_GAMEPAD: Record<OverlayMode, string> = {
  off: 'Enable virtual keyboard',
  keyboard: 'Disable virtual keyboard',
  gamepad: 'Disable virtual keyboard',
};

/** The button's title/aria label for the next click. */
export function overlayToggleLabel(
  mode: OverlayMode,
  gamepadInCycle: boolean,
): string {
  return (gamepadInCycle ? NEXT_LABEL : NEXT_LABEL_NO_GAMEPAD)[mode];
}
