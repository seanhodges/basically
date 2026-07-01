import { useEffect, useState } from 'react';
import { useIdeStore, type MobileTab } from './store';
import {
  useMediaQuery,
  MOBILE_QUERY,
  LANDSCAPE_MOBILE_QUERY,
} from './useMediaQuery';

/** How long the editor keyboard lingers after the editor loses focus —
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
 * The gamepad and keyboard are independent: each has its own enabled flag
 * (`controllerEnabled`, `keyboardEnabled`). When both are enabled
 * and the emulator is the active surface the gamepad takes priority and the
 * keyboard yields — but its enabled flag is untouched, so disabling the gamepad
 * brings the keyboard straight back. Phone landscape keeps its own single-slot
 * behaviour (the flanking gamepad yields to the keyboard whenever its toggle is
 * on, ignoring `controllerEnabled`).
 */
export function resolveInputOverlays(input: InputOverlayInput): InputOverlays {
  const {
    landscape,
    tabbed,
    mobileTab,
    routeToEditor,
    controllerEnabled,
    keyboardEnabled,
  } = input;

  const emulatorSurfaceActive = tabbed
    ? mobileTab === 'preview'
    : !routeToEditor;

  const controllerVisible = landscape
    ? emulatorSurfaceActive && !keyboardEnabled
    : controllerEnabled && emulatorSurfaceActive;

  const keyboardVisible =
    !controllerVisible &&
    keyboardEnabled &&
    (!tabbed || mobileTab === 'editor' || mobileTab === 'preview');

  const overlayUp = landscape
    ? keyboardEnabled
    : keyboardEnabled || (controllerEnabled && emulatorSurfaceActive);

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
  });

  return { ...overlays, routeToEditor };
}
