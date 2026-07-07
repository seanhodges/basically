import { describe, it, expect } from 'vitest';
import {
  resolveInputOverlays,
  type InputOverlayInput,
} from './useInputOverlays';

/** Desktop/tablet split layout (status-bar toggle, both panes visible). */
function split(over: Partial<InputOverlayInput> = {}): InputOverlayInput {
  return {
    landscape: false,
    tabbed: false,
    mobileTab: 'preview',
    routeToEditor: false, // emulator is the active surface
    controllerEnabled: false,
    keyboardEnabled: false,
    keyboardAutoShow: false,
    ...over,
  };
}

/** Mobile portrait tab layout (tabbed, not phone-landscape). */
function portrait(over: Partial<InputOverlayInput> = {}): InputOverlayInput {
  return {
    landscape: false,
    tabbed: true,
    mobileTab: 'preview',
    routeToEditor: false,
    controllerEnabled: false,
    keyboardEnabled: false,
    keyboardAutoShow: false,
    ...over,
  };
}

/** Phone-landscape tab layout (flanking gamepad, no status bar). */
function landscape(over: Partial<InputOverlayInput> = {}): InputOverlayInput {
  return {
    landscape: true,
    tabbed: true,
    mobileTab: 'preview',
    routeToEditor: false,
    controllerEnabled: false,
    keyboardEnabled: false,
    keyboardAutoShow: false,
    ...over,
  };
}

describe('resolveInputOverlays', () => {
  describe('desktop / tablet split', () => {
    it('gives the gamepad priority when both toggles are on and the emulator is focused', () => {
      const r = resolveInputOverlays(
        split({ controllerEnabled: true, keyboardEnabled: true }),
      );
      expect(r.controllerVisible).toBe(true);
      expect(r.keyboardVisible).toBe(false);
      expect(r.overlayUp).toBe(true);
    });

    it('brings the keyboard back when the gamepad is disabled while the keyboard stays enabled', () => {
      const r = resolveInputOverlays(
        split({ controllerEnabled: false, keyboardEnabled: true }),
      );
      expect(r.controllerVisible).toBe(false);
      expect(r.keyboardVisible).toBe(true);
    });

    it('shows only the keyboard when only the keyboard is enabled', () => {
      const r = resolveInputOverlays(split({ keyboardEnabled: true }));
      expect(r.controllerVisible).toBe(false);
      expect(r.keyboardVisible).toBe(true);
    });

    it('shows only the gamepad when only the gamepad is enabled', () => {
      const r = resolveInputOverlays(split({ controllerEnabled: true }));
      expect(r.controllerVisible).toBe(true);
      expect(r.keyboardVisible).toBe(false);
    });

    it('shows neither overlay when both are off and auto-show is off', () => {
      const r = resolveInputOverlays(split());
      expect(r.controllerVisible).toBe(false);
      expect(r.keyboardVisible).toBe(false);
      expect(r.overlayUp).toBe(false);
    });

    it('auto-shows the keyboard on the emulator surface (rule 3a)', () => {
      const r = resolveInputOverlays(split({ keyboardAutoShow: true }));
      expect(r.keyboardVisible).toBe(true);
      expect(r.controllerVisible).toBe(false);
      expect(r.overlayUp).toBe(true);
    });
  });

  describe('editor surface (editor focused / editor tab)', () => {
    it('routes an enabled keyboard to the editor and never shows the gamepad', () => {
      const r = resolveInputOverlays(
        split({
          controllerEnabled: true,
          keyboardEnabled: true,
          routeToEditor: true,
        }),
      );
      expect(r.controllerVisible).toBe(false);
      expect(r.keyboardVisible).toBe(true);
    });

    it('never shows the gamepad while editing, even with the gamepad enabled', () => {
      const r = resolveInputOverlays(
        split({ controllerEnabled: true, routeToEditor: true }),
      );
      expect(r.controllerVisible).toBe(false);
      expect(r.keyboardVisible).toBe(false);
    });

    it('auto-shows the keyboard for the editor (rule 3b)', () => {
      const r = resolveInputOverlays(
        split({ keyboardAutoShow: true, routeToEditor: true }),
      );
      expect(r.keyboardVisible).toBe(true);
      expect(r.controllerVisible).toBe(false);
    });
  });

  describe('mobile portrait', () => {
    it('defaults to the gamepad on the preview tab with nothing enabled (rule 4)', () => {
      const r = resolveInputOverlays(portrait());
      expect(r.controllerVisible).toBe(true);
      expect(r.keyboardVisible).toBe(false);
      expect(r.overlayUp).toBe(true);
    });

    it('auto-show beats the rule-4 gamepad default on the preview tab', () => {
      const r = resolveInputOverlays(portrait({ keyboardAutoShow: true }));
      expect(r.keyboardVisible).toBe(true);
      expect(r.controllerVisible).toBe(false);
    });

    it('the gamepad toggle still wins over auto-show (rule 1)', () => {
      const r = resolveInputOverlays(
        portrait({ controllerEnabled: true, keyboardAutoShow: true }),
      );
      expect(r.controllerVisible).toBe(true);
      expect(r.keyboardVisible).toBe(false);
    });

    it('shows neither overlay on the AI/Settings tabs', () => {
      const r = resolveInputOverlays(
        portrait({ mobileTab: 'ai', keyboardAutoShow: true }),
      );
      expect(r.controllerVisible).toBe(false);
      expect(r.keyboardVisible).toBe(false);
    });
  });

  describe('phone landscape', () => {
    it('flanks the gamepad by default on the preview tab', () => {
      const r = resolveInputOverlays(landscape());
      expect(r.controllerVisible).toBe(true);
      expect(r.keyboardVisible).toBe(false);
      // The flanking gamepad doesn't dock, so it never shrinks the screen.
      expect(r.overlayUp).toBe(false);
    });

    it('swaps the flanking gamepad for the keyboard when its toggle is on', () => {
      const r = resolveInputOverlays(landscape({ keyboardEnabled: true }));
      expect(r.controllerVisible).toBe(false);
      expect(r.keyboardVisible).toBe(true);
      // A docked keyboard does shrink the screen.
      expect(r.overlayUp).toBe(true);
    });

    it('honours the gamepad toggle over the keyboard toggle (rule 1)', () => {
      const r = resolveInputOverlays(
        landscape({ controllerEnabled: true, keyboardEnabled: true }),
      );
      expect(r.controllerVisible).toBe(true);
      expect(r.keyboardVisible).toBe(false);
    });

    it('ignores auto-show (rule 3 excluded), keeping the flanking gamepad', () => {
      const r = resolveInputOverlays(landscape({ keyboardAutoShow: true }));
      expect(r.controllerVisible).toBe(true);
      expect(r.keyboardVisible).toBe(false);
    });
  });
});
