import type { ChatImage } from '../ai/providers/types';

/**
 * The machine's display, captured as an image so the AI assistant can be shown
 * what a program actually drew.
 *
 * Taken from the canvas the emulator pane already renders `machine.renderTo`
 * into, deliberately rather than from a new `MachineEmulator` member: every
 * machine already answers "what do you look like" through `renderTo`, and the
 * canvas is definitionally what the user is looking at - which is what they
 * mean when they ask the assistant to look at it.
 */
export interface ScreenCapture extends ChatImage {
  /** Pixel size of the captured image, after upscaling. */
  width: number;
  height: number;
}

/**
 * What an upscaled capture aims for, and never exceeds, on its long edge.
 *
 * These displays are 256x192-ish, which providers are free to resample on the
 * way in - and resampling smears exactly the single-pixel plot lines and 8x8
 * character cells the assistant is being shown. Reaching a few hundred pixels
 * by an integer factor is the one resize that cannot invent a pixel that was
 * not there; the cap keeps the image in the hundreds of tokens rather than the
 * thousands.
 */
export const CAPTURE_MIN_LONG_EDGE = 512;
export const CAPTURE_MAX_LONG_EDGE = 1024;

/**
 * The integer factor a display of this size is upscaled by: the smallest that
 * reaches {@link CAPTURE_MIN_LONG_EDGE}, held under
 * {@link CAPTURE_MAX_LONG_EDGE}.
 *
 * Never below 1:1. A display already past the cap is sent at its native size
 * rather than shrunk: downscaling drops pixels, and the dropped pixel is
 * precisely the plotted line being asked about.
 */
export function captureScale(width: number, height: number): number {
  const long = Math.max(width, height);
  if (!Number.isFinite(long) || long <= 0) return 1;
  let factor = Math.max(1, Math.ceil(CAPTURE_MIN_LONG_EDGE / long));
  while (factor > 1 && long * factor > CAPTURE_MAX_LONG_EDGE) factor--;
  return factor;
}

/**
 * Capture a canvas as an upscaled PNG.
 *
 * PNG rather than JPEG: these screens are lossless-cheap (tiny palettes, large
 * flat areas) and JPEG's chroma subsampling is actively destructive on
 * one-pixel lines.
 *
 * Best-effort by design - a null comes back for a canvas that isn't there, a
 * context the browser won't give, or a `toDataURL` that throws. Being unable to
 * show the screen must never break the run check that asked for it.
 */
export function captureFromCanvas(
  canvas: HTMLCanvasElement | null,
): ScreenCapture | null {
  if (!canvas || canvas.width === 0 || canvas.height === 0) return null;
  try {
    const factor = captureScale(canvas.width, canvas.height);
    const width = canvas.width * factor;
    const height = canvas.height * factor;
    const scaled = document.createElement('canvas');
    scaled.width = width;
    scaled.height = height;
    const ctx = scaled.getContext('2d');
    if (!ctx) return null;
    // Nearest-neighbour: the pixels are the content.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, 0, 0, width, height);
    const url = scaled.toDataURL('image/png');
    if (!url.startsWith('data:image/png;base64,')) return null;
    const base64 = url.slice(url.indexOf(',') + 1);
    if (base64 === '') return null;
    return { mediaType: 'image/png', base64, width, height };
  } catch {
    return null;
  }
}

/**
 * The live capture, registered by the emulator pane while it has a rendered
 * frame, and the last one taken before that pane went away.
 *
 * Module-level rather than store state, for the same reason the AI stream
 * handle is: neither is render data. What the UI does need - whether there is
 * anything to show at all - is mirrored into the store as a flag.
 *
 * The snapshot is what makes this work at all on the layouts where opening the
 * assistant unmounts the emulator: without it, "show the assistant the screen"
 * would be unavailable in exactly the situation where the user asks for it.
 */
let live: (() => ScreenCapture | null) | null = null;
let last: ScreenCapture | null = null;

/** Register the live capture; returns the matching unregister. */
export function registerScreenCapture(
  capture: () => ScreenCapture | null,
): () => void {
  live = capture;
  return () => {
    if (live === capture) live = null;
  };
}

/**
 * Capture now and keep it as the last known display. Called as the emulator is
 * torn down (unmount, stop), while there is still a frame to take.
 */
export function snapshotScreen(): ScreenCapture | null {
  const shot = live?.() ?? null;
  if (shot) last = shot;
  return shot;
}

/** The current display, falling back to the last one taken before teardown. */
export function captureScreen(): ScreenCapture | null {
  return live?.() ?? last;
}

/** Whether there is any display to show the assistant. */
export function hasScreenCapture(): boolean {
  return live !== null || last !== null;
}

/**
 * Drop both, so a screen from a machine that is no longer the active one can't
 * be attached to a question about this one.
 */
export function forgetScreenCapture(): void {
  live = null;
  last = null;
}
