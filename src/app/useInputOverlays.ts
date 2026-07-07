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
 *   3. auto-show + a pane focused, not mobile-landscape → keyboard
 *   4. mobile + emulator shown + no keyboard → gamepad (default)
 *   5. otherwise                    → neither
 *
 * The gamepad is an emulator-surface overlay: while the editor is the active
 * surface it never shows (the keyboard routes to the editor instead). Auto-show
 * is derived here rather than mutating `keyboardEnabled`, so the two enabled
 * flags mean only explicit user intent.
 */
export function resolveInputOverlays(input: InputOverlayInput): InputOverlays {
  const {
    landscape,
    tabbed,
    mobileTab,
    routeToEditor,
    controllerEnabled,
    keyboardEnabled,
    keyboardAutoShow,
  } = input;

  const emulatorSurfaceActive = tabbed
    ? mobileTab === 'preview'
    : !routeToEditor;
  const editorSurfaceActive = tabbed ? mobileTab === 'editor' : routeToEditor;
  // A touch phone/tablet uses the single-pane tab layout; "mobile" here means any
  // tab layout (portrait or phone landscape), which is where the gamepad is the
  // default emulator overlay (rule 4).
  const mobile = tabbed;
  // Auto-show never applies in phone landscape (the flanking gamepad is the
  // default surface there and an auto-shown keyboard would cover it).
  const autoKeyboard = keyboardAutoShow && !landscape;

  const controllerVisible =
    emulatorSurfaceActive &&
    (controllerEnabled || // rule 1
      (mobile && !keyboardEnabled && !autoKeyboard)); // rule 4 default

  const keyboardVisible =
    !controllerVisible &&
    (keyboardEnabled || autoKeyboard) && // rules 2 & 3
    (emulatorSurfaceActive || editorSurfaceActive); // never on AI/Settings tabs

  // The bottom band is occupied by a *docked* overlay. The flanking phone-
  // landscape gamepad doesn't dock (it flanks the screen), so it doesn't shrink
  // the screen height there.
  const overlayUp = keyboardVisible || (controllerVisible && !landscape);

  return {
    emulatorSurfaceActive,
    controllerVisible,
    keyboardVisible,
    overlayUp,
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
  const mobileTab = useIdeStore((s) => s.mobileTab);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const landscape = useMediaQuery(LANDSCAPE_MOBILE_QUERY);
  const tabbed = isMobile || landscape;

  const showEditorKeyboard = useDebouncedFalse(
    editorFocused,
    EDITOR_KB_HIDE_DELAY_MS,
  );
  // On the tab layout the active tab decides the target; on the desktop/tablet
  // split editor focus does (debounced to avoid remount thrash when focus
  // briefly leaves the editor).
  const routeToEditor = tabbed ? mobileTab === 'editor' : showEditorKeyboard;

  const overlays = resolveInputOverlays({
    landscape,
    tabbed,
    mobileTab,
    routeToEditor,
    controllerEnabled,
    keyboardEnabled,
    keyboardAutoShow,
  });

  return { ...overlays, routeToEditor };
}
