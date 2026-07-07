import { GamepadIcon } from './icons';

/** The three positions of the input-overlay control, derived from the two
    independent intent flags. */
type OverlayMode = 'off' | 'keyboard' | 'gamepad';

/**
 * Current mode from the two flags. The gamepad wins when both are set, which
 * also normalises any legacy both-on state (the button never writes it) to a
 * single well-defined position.
 */
function overlayModeOf(
  keyboardEnabled: boolean,
  controllerEnabled: boolean,
): OverlayMode {
  if (controllerEnabled) return 'gamepad';
  if (keyboardEnabled) return 'keyboard';
  return 'off';
}

/** Cycle order: off → keyboard → gamepad → off. */
const NEXT_MODE: Record<OverlayMode, OverlayMode> = {
  off: 'keyboard',
  keyboard: 'gamepad',
  gamepad: 'off',
};

/** What the next click does, from each current mode (matches the user's labels). */
const NEXT_LABEL: Record<OverlayMode, string> = {
  off: 'Enable virtual keyboard',
  keyboard: 'Enable virtual gamepad',
  gamepad: 'Disable virtual keyboard and gamepad',
};

export interface InputOverlayToggleProps {
  keyboardEnabled: boolean;
  controllerEnabled: boolean;
  setKeyboardEnabled: (v: boolean) => void;
  setControllerEnabled: (v: boolean) => void;
  /** Base button class from the host stylesheet. */
  className?: string;
  /** Class added while a mode is active (keyboard/gamepad), i.e. not 'off'. */
  activeClassName?: string;
}

/**
 * The single input-overlay control, reused in every layout (IDE status bar,
 * phone-landscape rail, standalone player top bar). One button cycles
 * off → keyboard → gamepad, writing the two mutually-exclusive intent flags.
 * What actually renders is resolved centrally in `useInputOverlays`, so 'off'
 * may still show the keyboard (auto-show) or the gamepad (mobile default).
 */
export function InputOverlayToggle({
  keyboardEnabled,
  controllerEnabled,
  setKeyboardEnabled,
  setControllerEnabled,
  className,
  activeClassName,
}: InputOverlayToggleProps) {
  const mode = overlayModeOf(keyboardEnabled, controllerEnabled);
  const active = mode !== 'off';

  const cycle = () => {
    const next = NEXT_MODE[mode];
    setControllerEnabled(next === 'gamepad');
    setKeyboardEnabled(next === 'keyboard');
  };

  const classes = [className, active ? activeClassName : undefined]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      data-testid="input-overlay-toggle"
      data-mode={mode}
      className={classes}
      title={NEXT_LABEL[mode]}
      aria-label={NEXT_LABEL[mode]}
      // Don't steal focus from the editor: a focus loss would (250ms later)
      // reroute a freshly-shown keyboard to a stopped machine (see
      // useInputOverlays' debounced routeToEditor).
      onMouseDown={(e) => e.preventDefault()}
      onClick={cycle}
    >
      {mode === 'gamepad' ? <GamepadIcon /> : '⌨'}
    </button>
  );
}
