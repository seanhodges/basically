import { describe, it, expect, beforeEach } from 'vitest';
import {
  captureFromCanvas,
  captureScreen,
  forgetScreenCapture,
  hasScreenCapture,
  registerScreenCapture,
  snapshotScreen,
  type ScreenCapture,
} from './screenCapture';

const shot = (base64: string): ScreenCapture => ({
  mediaType: 'image/png',
  base64,
  width: 256,
  height: 192,
});

/** A stand-in for the pane's canvas - the only part of it this module reads. */
const fakeCanvas = (
  width: number,
  height: number,
  toDataURL: () => string,
): HTMLCanvasElement =>
  ({ width, height, toDataURL }) as unknown as HTMLCanvasElement;

describe('captureFromCanvas', () => {
  it('captures at the machine’s own size, never scaled', () => {
    const capture = captureFromCanvas(
      fakeCanvas(256, 192, () => 'data:image/png;base64,PNGDATA'),
    );
    expect(capture).toEqual({
      mediaType: 'image/png',
      base64: 'PNGDATA',
      width: 256,
      height: 192,
    });
  });

  it('is null when the browser refuses to encode', () => {
    expect(
      captureFromCanvas(
        fakeCanvas(256, 192, () => {
          throw new Error('tainted canvas');
        }),
      ),
    ).toBeNull();
  });

  it('is null for anything that is not a PNG data URL', () => {
    expect(
      captureFromCanvas(fakeCanvas(256, 192, () => 'data:image/gif;base64,X')),
    ).toBeNull();
    expect(
      captureFromCanvas(fakeCanvas(256, 192, () => 'data:image/png;base64,')),
    ).toBeNull();
  });

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
