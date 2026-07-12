import { useEffect, useState } from 'react';
import { useIdeStore, type MobileTab } from './store';
import {
  useMediaQuery,
  MOBILE_QUERY,
  LANDSCAPE_MOBILE_QUERY,
} from './useMediaQuery';

/** How long the editor keyboard lingers after the editor loses focus -
    avoids flicker when focus briefly moves (toolbar taps, prompts). */
export const EDITOR_KB_HIDE_DELAY_MS = 250;

/** True immediately when `value` is true; false only after a short delay. */
function useDebouncedFalse(value: boolean, delayMs: number): boolean {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (value) {
      setDebounced(true);
      return;
    }
    const timer = setTimeout(() => setDebounced(false), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export interface InputOverlayInput {
  /** Phone-landscape layout (flanking gamepad, no status bar). */
  landscape: boolean;
  /** Single-pane tab layout (mobile portrait or phone landscape). */
  tabbed: boolean;
  mobileTab: MobileTab;
  /** The editor is the active input surface (debounced editor focus on the
      split; the editor tab on the tab layout). */
  routeToEditor: boolean;
  /** The editor or emulator currently holds DOM focus (debounced). Gates
      auto-show: the keyboard only pops when a pane is actually focused. */
  paneFocused: boolean;
  controllerEnabled: boolean;
  keyboardEnabled: boolean;
  /** The "pop the keyboard up automatically" preference (persisted, defaults on
      for touch). Fed in so auto-show is a derived rule here, not a side effect
      that mutates `keyboardEnabled`. */
  keyboardAutoShow: boolean;
}

export interface InputOverlays {
  /** The emulator (not the editor) is the active input surface. */
  emulatorSurfaceActive: boolean;
  /** The on-screen game controller overlay should render. */
  controllerVisible: boolean;
  /** The on-screen keyboard overlay should render. */
  keyboardVisible: boolean;
  /** The bottom band is occupied, so the emulator screen shrinks to make room. */
  overlayUp: boolean;
  /**
   * The gamepad is a meaningful third position for the input-overlay toggle.
   * It only is when the gamepad's visibility actually follows the toggle: the
   * emulator surface, on every layout. While editing the gamepad is never shown,
   * so there the toggle drops it and cycles only off/auto ↔ keyboard.
   */
  gamepadToggleable: boolean;
}

/**
 * Single source of truth for which input overlay (gamepad vs keyboard) is shown
 * and whether it caps the emulator screen. Both `Workspace` (which renders the
 * overlays) and `EmulatorPane` (which sizes the screen via `overlayUp`) derive
 * from this, so they can never disagree during focus transitions.
 *
 * Resolves the agreed priority list (first match wins), identically for every
 * layout and for the standalone player:
 *   1. gamepad toggle on            → gamepad (all layouts, highest priority)
 *   2. keyboard toggle on           → keyboard
 *   3. auto-show + editor/emulator focused → keyboard (except the phone-landscape
 *      emulator surface, where an auto-shown keyboard would cover the flanking
 *      gamepad, so it's suppressed)
 *   4. otherwise                    → neither
 *
 * The gamepad is an opt-in emulator-surface overlay: it shows only when its
 * toggle is on and the emulator is the active surface (while the editor is
 * active it never shows — the keyboard routes to the editor instead). Auto-show
 * is derived here rather than mutating `keyboardEnabled`, so the two enabled
 * flags mean only explicit user intent.
 */
export function resolveInputOverlays(input: InputOverlayInput): InputOverlays {
  const {
    landscape,
    tabbed,
    mobileTab,
    routeToEditor,
    paneFocused,
    controllerEnabled,
    keyboardEnabled,
    keyboardAutoShow,
  } = input;

  const emulatorSurfaceActive = tabbed
    ? mobileTab === 'preview'
    : !routeToEditor;
  const editorSurfaceActive = tabbed ? mobileTab === 'editor' : routeToEditor;
  // Auto-show pops the keyboard only while the editor or emulator actually holds
  // focus (tapping into a pane), not just because a pane is the default active
  // surface. In phone landscape the emulator surface suppresses auto-show: the
  // flanking gamepad lives there, so an auto-shown keyboard would cover it. The
  // editor tab has no gamepad, so auto-show still applies to it.
  const autoKeyboard =
    keyboardAutoShow && paneFocused && !(landscape && emulatorSurfaceActive);

  // The gamepad is opt-in on every layout: shown only where its toggle is on and
  // the emulator is the active surface (rule 1).
  const controllerVisible = emulatorSurfaceActive && controllerEnabled;

  const keyboardVisible =
    !controllerVisible &&
    (keyboardEnabled || autoKeyboard) && // rules 2 & 3
    (emulatorSurfaceActive || editorSurfaceActive); // never on AI/Settings tabs

  // The bottom band is occupied by a *docked* overlay. The flanking phone-
  // landscape gamepad doesn't dock (it flanks the screen), so it doesn't shrink
  // the screen height there.
  const overlayUp = keyboardVisible || (controllerVisible && !landscape);

  // The gamepad earns its place in the toggle cycle only where its visibility
  // tracks the toggle: the emulator surface, on every layout. On the editor
  // surface it never shows, so there the toggle drops it.
  const gamepadToggleable = emulatorSurfaceActive;

  return {
    emulatorSurfaceActive,
    controllerVisible,
    keyboardVisible,
    overlayUp,
    gamepadToggleable,
  };
}

export interface UseInputOverlays extends InputOverlays {
  /** The editor is the active input surface (keyboard routes there). */
  routeToEditor: boolean;
}

/**
 * Reads the live store + media queries and resolves the input overlays. Applies
 * the same debounce to editor focus that the split layout uses, so a brief focus
 * change (toolbar tap, prompt) doesn't flicker the overlay hand-off.
 */
export function useInputOverlays(): UseInputOverlays {
  const keyboardEnabled = useIdeStore((s) => s.keyboardEnabled);
  const controllerEnabled = useIdeStore((s) => s.controllerEnabled);
  const keyboardAutoShow = useIdeStore((s) => s.keyboardAutoShow);
  const editorFocused = useIdeStore((s) => s.editorFocused);
  const emulatorFocused = useIdeStore((s) => s.emulatorFocused);
  const mobileTab = useIdeStore((s) => s.mobileTab);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const landscape = useMediaQuery(LANDSCAPE_MOBILE_QUERY);
  const tabbed = isMobile || landscape;

  const showEditorKeyboard = useDebouncedFalse(
    editorFocused,
    EDITOR_KB_HIDE_DELAY_MS,
  );
  const showEmulatorKeyboard = useDebouncedFalse(
    emulatorFocused,
    EDITOR_KB_HIDE_DELAY_MS,
  );
  // On the tab layout the active tab decides the target; on the desktop/tablet
  // split editor focus does (debounced to avoid remount thrash when focus
  // briefly leaves the editor).
  const routeToEditor = tabbed ? mobileTab === 'editor' : showEditorKeyboard;
  // Auto-show fires only while a pane holds focus. Both signals are debounced so
  // a brief blur (toolbar tap, tapping an on-screen key) doesn't drop the
  // keyboard. Hidden panes can't hold DOM focus, so on the tab layout this
  // naturally tracks the visible pane.
  const paneFocused = showEditorKeyboard || showEmulatorKeyboard;

  const overlays = resolveInputOverlays({
    landscape,
    tabbed,
    mobileTab,
    routeToEditor,
    paneFocused,
    controllerEnabled,
    keyboardEnabled,
    keyboardAutoShow,
  });

  return { ...overlays, routeToEditor };
}
