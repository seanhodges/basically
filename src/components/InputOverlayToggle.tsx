import { GamepadIcon } from './icons';
import {
  type OverlayMode,
  overlayModeOf,
  nextOverlayFlags,
  overlayToggleLabel,
} from './inputOverlayMode';

export interface InputOverlayToggleProps {
  keyboardEnabled: boolean;
  controllerEnabled: boolean;
  setKeyboardEnabled: (v: boolean) => void;
  setControllerEnabled: (v: boolean) => void;
  /** Base button class from the host stylesheet. */
  className?: string;
  /** Class added while a mode is active (keyboard/gamepad), i.e. not 'off'. */
  activeClassName?: string;
  /**
   * Whether the gamepad is a meaningful third position here. Defaults to true.
   * When false the control is a two-way toggle (off/auto ↔ keyboard) and never
   * enables the gamepad — used where the gamepad is never shown (the editor
   * surface). See `gamepadToggleable` in `useInputOverlays`.
   */
  gamepadInCycle?: boolean;
}

/**
 * The single input-overlay control, reused in every layout (IDE status bar,
 * phone-landscape rail, standalone player top bar). One button cycles
 * off → keyboard → gamepad, writing the two mutually-exclusive intent flags —
 * or, when `gamepadInCycle` is false, off/auto ↔ keyboard only (the gamepad is
 * never shown there, i.e. the editor surface). What actually renders is resolved
 * centrally in `useInputOverlays`, so 'off' may still show the keyboard
 * (auto-show).
 */
export function InputOverlayToggle({
  keyboardEnabled,
  controllerEnabled,
  setKeyboardEnabled,
  setControllerEnabled,
  className,
  activeClassName,
  gamepadInCycle = true,
}: InputOverlayToggleProps) {
  const mode = overlayModeOf(keyboardEnabled, controllerEnabled);
  // In the two-way cycle only the keyboard counts as active: a stale gamepad
  // state isn't shown here, so it shouldn't light the button.
  const active = gamepadInCycle ? mode !== 'off' : keyboardEnabled;

  const cycle = () => {
    const next = nextOverlayFlags(mode, gamepadInCycle);
    setControllerEnabled(next.controllerEnabled);
    setKeyboardEnabled(next.keyboardEnabled);
  };

  const label = overlayToggleLabel(mode, gamepadInCycle);
  // The gamepad glyph (and data-mode) only reflect the gamepad where it's
  // actually reachable; the two-way toggle presents purely as keyboard/off.
  const displayMode: OverlayMode = gamepadInCycle
    ? mode
    : keyboardEnabled
      ? 'keyboard'
      : 'off';

  const classes = [className, active ? activeClassName : undefined]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      data-testid="input-overlay-toggle"
      data-mode={displayMode}
      className={classes}
      title={label}
      aria-label={label}
      // Don't steal focus from the editor: a focus loss would (250ms later)
      // reroute a freshly-shown keyboard to a stopped machine (see
      // useInputOverlays' debounced routeToEditor).
      onMouseDown={(e) => e.preventDefault()}
      onClick={cycle}
    >
      {displayMode === 'gamepad' ? <GamepadIcon /> : '⌨'}
    </button>
  );
}
