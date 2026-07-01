import { describe, it, expect } from 'vitest';
import {
  resolveInputOverlays,
  type InputOverlayInput,
} from './useInputOverlays';

/** Desktop/tablet split layout (both toggle buttons visible in the status bar). */
function split(over: Partial<InputOverlayInput> = {}): InputOverlayInput {
  return {
    landscape: false,
    tabbed: false,
    mobileTab: 'preview',
    routeToEditor: false, // emulator is the active surface
    controllerEnabled: false,
    keyboardEnabled: false,
    ...over,
  };
}

describe('resolveInputOverlays', () => {
  it('gives the gamepad priority when both are enabled and the emulator is focused', () => {
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

  it('hides the gamepad and shows the keyboard when the editor is focused, even with the gamepad enabled', () => {
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

  it('shows neither overlay when both are disabled', () => {
    const r = resolveInputOverlays(split());
    expect(r.controllerVisible).toBe(false);
    expect(r.keyboardVisible).toBe(false);
    expect(r.overlayUp).toBe(false);
  });

  describe('phone landscape (unchanged single-slot behaviour)', () => {
    const landscape = (
      over: Partial<InputOverlayInput> = {},
    ): InputOverlayInput => ({
      landscape: true,
      tabbed: true,
      mobileTab: 'preview',
      routeToEditor: false,
      controllerEnabled: false,
      keyboardEnabled: false,
      ...over,
    });

    it('flanks the gamepad by default (ignoring controllerEnabled) on the preview tab', () => {
      const r = resolveInputOverlays(landscape());
      expect(r.controllerVisible).toBe(true);
      expect(r.keyboardVisible).toBe(false);
    });

    it('swaps the flanking gamepad for the keyboard when its toggle is on', () => {
      const r = resolveInputOverlays(landscape({ keyboardEnabled: true }));
      expect(r.controllerVisible).toBe(false);
      expect(r.keyboardVisible).toBe(true);
    });
  });
});
