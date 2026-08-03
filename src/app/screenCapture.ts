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
  /** Pixel size of the captured image: the machine's own display size. */
  width: number;
  height: number;
}

/**
 * Capture a canvas as a PNG, at the machine's own resolution.
 *
 * Native, not upscaled. The worry that a provider's own resampling would smear
 * single-pixel plot lines and 8x8 character cells turns out not to survive
 * measurement: across captures on three machines the native image read back
 * correctly every time - a Spectrum menu character-for-character, the BBC's
 * concentric circles in the right colours and the right order - while a 3x
 * upscale cost 8.4x the visual tokens and added nothing. At
 * `ceil(w / 28) x ceil(h / 28)` tokens a 256x192 screen is about 70, which is
 * cheaper than the same screen sent as text.
 *
 * So there is no offscreen canvas and no resize: the pane's canvas is already
 * the machine's display at its own size, and this reads it straight out.
 *
 * PNG rather than JPEG: these screens are lossless-cheap (tiny palettes, large
 * flat areas) and JPEG's chroma subsampling is actively destructive on
 * one-pixel lines.
 *
 * Best-effort by design - a null comes back for a canvas that isn't there or a
 * `toDataURL` that throws. Being unable to show the screen must never break the
 * run check that asked for it.
 */
export function captureFromCanvas(
  canvas: HTMLCanvasElement | null,
): ScreenCapture | null {
  if (!canvas || canvas.width === 0 || canvas.height === 0) return null;
  try {
    const url = canvas.toDataURL('image/png');
    if (!url.startsWith('data:image/png;base64,')) return null;
    const base64 = url.slice(url.indexOf(',') + 1);
    if (base64 === '') return null;
    return {
      mediaType: 'image/png',
      base64,
      width: canvas.width,
      height: canvas.height,
    };
  } catch {
    return null;
  }
}

/**
 * The live capture, registered by the emulator pane while it has a rendered
 * frame, and the last one taken before that pane went away.
 *
 * Module-level rather than store state, for the same reason the AI stream
 * handle is: neither is render data.
 *
 * The snapshot keeps the machine's last frame readable after the pane has
 * stopped rendering one - a stopped machine is still showing what it drew.
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

/** Whether there is any display to capture. */
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
