import { describe, it, expect } from 'vitest';
import { overlayModeOf, nextOverlayFlags } from './inputOverlayMode';

describe('overlayModeOf', () => {
  it('prefers the gamepad when both flags are set', () => {
    expect(overlayModeOf(true, true)).toBe('gamepad');
  });

  it('maps each single flag to its mode, and neither to off', () => {
    expect(overlayModeOf(true, false)).toBe('keyboard');
    expect(overlayModeOf(false, true)).toBe('gamepad');
    expect(overlayModeOf(false, false)).toBe('off');
  });
});

describe('nextOverlayFlags', () => {
  describe('gamepad in the cycle (off → keyboard → gamepad → off)', () => {
    it('off advances to keyboard', () => {
      expect(nextOverlayFlags('off', true)).toEqual({
        keyboardEnabled: true,
        controllerEnabled: false,
      });
    });

    it('keyboard advances to gamepad', () => {
      expect(nextOverlayFlags('keyboard', true)).toEqual({
        keyboardEnabled: false,
        controllerEnabled: true,
      });
    });

    it('gamepad advances back to off', () => {
      expect(nextOverlayFlags('gamepad', true)).toEqual({
        keyboardEnabled: false,
        controllerEnabled: false,
      });
    });
  });

  describe('gamepad excluded (two-way off/auto ↔ keyboard)', () => {
    it('off advances to keyboard', () => {
      expect(nextOverlayFlags('off', false)).toEqual({
        keyboardEnabled: true,
        controllerEnabled: false,
      });
    });

    it('keyboard advances back to off, never to gamepad', () => {
      expect(nextOverlayFlags('keyboard', false)).toEqual({
        keyboardEnabled: false,
        controllerEnabled: false,
      });
    });

    it('collapses a stale gamepad state straight to keyboard', () => {
      expect(nextOverlayFlags('gamepad', false)).toEqual({
        keyboardEnabled: true,
        controllerEnabled: false,
      });
    });

    it('never enables the gamepad from any starting mode', () => {
      for (const mode of ['off', 'keyboard', 'gamepad'] as const) {
        expect(nextOverlayFlags(mode, false).controllerEnabled).toBe(false);
      }
    });
  });
});
