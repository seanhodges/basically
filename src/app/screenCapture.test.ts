import { describe, it, expect, beforeEach } from 'vitest';
import {
  captureScale,
  captureFromCanvas,
  captureScreen,
  forgetScreenCapture,
  hasScreenCapture,
  registerScreenCapture,
  snapshotScreen,
  CAPTURE_MAX_LONG_EDGE,
  CAPTURE_MIN_LONG_EDGE,
  type ScreenCapture,
} from './screenCapture';

const shot = (base64: string): ScreenCapture => ({
  mediaType: 'image/png',
  base64,
  width: 512,
  height: 384,
});

describe('captureScale', () => {
  it('upscales a small display to at least the target long edge', () => {
    // ZX81/Spectrum-shaped: 256 doubles to 512.
    expect(captureScale(256, 192)).toBe(2);
    // Commodore-shaped: 320 doubles to 640 - the smallest factor that reaches
    // the target, not the largest that fits under the cap.
    expect(captureScale(320, 200)).toBe(2);
    // Scaled by the long edge, not the width: 160x200 goes by its 200.
    expect(captureScale(160, 200)).toBe(3);
  });

  it('never takes the long edge past the cap', () => {
    for (const [w, h] of [
      [256, 192],
      [320, 200],
      [352, 288],
      [640, 256],
      [768, 272],
    ]) {
      const factor = captureScale(w!, h!);
      expect(Math.max(w!, h!) * factor).toBeLessThanOrEqual(
        CAPTURE_MAX_LONG_EDGE,
      );
    }
  });

  it('reaches the target long edge wherever the cap allows', () => {
    for (const [w, h] of [
      [256, 192],
      [320, 200],
      [352, 288],
    ]) {
      expect(Math.max(w!, h!) * captureScale(w!, h!)).toBeGreaterThanOrEqual(
        CAPTURE_MIN_LONG_EDGE,
      );
    }
  });

  it('leaves a display that is already big enough at 1:1', () => {
    expect(captureScale(640, 256)).toBe(1);
    expect(captureScale(512, 384)).toBe(1);
  });

  it('never downscales, even past the cap', () => {
    // Doubling would breach the cap and halving would drop pixels, so 1:1.
    expect(captureScale(1200, 800)).toBe(1);
  });

  it('answers 1 for a degenerate size rather than dividing by zero', () => {
    expect(captureScale(0, 0)).toBe(1);
    expect(captureScale(Number.NaN, 100)).toBe(1);
  });
});

describe('captureFromCanvas', () => {
  it('is null when there is no canvas', () => {
    expect(captureFromCanvas(null)).toBeNull();
  });

  it('is null for a canvas with no pixels', () => {
    const empty = { width: 0, height: 0 } as HTMLCanvasElement;
    expect(captureFromCanvas(empty)).toBeNull();
  });
});

describe('the registered capture', () => {
  beforeEach(() => forgetScreenCapture());

  it('has nothing to show before anything registers', () => {
    expect(hasScreenCapture()).toBe(false);
    expect(captureScreen()).toBeNull();
  });

  it('captures live while registered', () => {
    registerScreenCapture(() => shot('live'));
    expect(hasScreenCapture()).toBe(true);
    expect(captureScreen()?.base64).toBe('live');
  });

  it('falls back to the last snapshot once unregistered', () => {
    const unregister = registerScreenCapture(() => shot('frame'));
    snapshotScreen();
    unregister();
    expect(hasScreenCapture()).toBe(true);
    expect(captureScreen()?.base64).toBe('frame');
  });

  it('prefers the live display over an older snapshot', () => {
    const unregister = registerScreenCapture(() => shot('old'));
    snapshotScreen();
    unregister();
    registerScreenCapture(() => shot('new'));
    expect(captureScreen()?.base64).toBe('new');
  });

  it('keeps no snapshot when there was nothing to capture', () => {
    registerScreenCapture(() => null);
    expect(snapshotScreen()).toBeNull();
    expect(captureScreen()).toBeNull();
  });

  it('unregistering a superseded capture leaves the current one alone', () => {
    const stale = registerScreenCapture(() => shot('first'));
    registerScreenCapture(() => shot('second'));
    stale();
    expect(captureScreen()?.base64).toBe('second');
  });

  it('forgets both the live capture and the snapshot', () => {
    registerScreenCapture(() => shot('live'));
    snapshotScreen();
    forgetScreenCapture();
    expect(hasScreenCapture()).toBe(false);
    expect(captureScreen()).toBeNull();
  });
});
