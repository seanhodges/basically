// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Save the machine's screen as a PNG.
 *
 * The picture is the machine's own output and nothing else: the pixels it drew,
 * at its own display size, enlarged by a whole number so every machine pixel
 * stays a square block. Nothing the IDE draws around or over the screen - the
 * bezel, the fitted scale, the CRT overlay - reaches the file. The CRT effect in
 * particular is a CSS pseudo-element sized in screen pixels over a canvas fitted
 * at a fractional scale, so it has no honest size in machine pixels; redrawing it
 * would be right at one window size and wrong at every other.
 *
 * Pixels come from {@link captureScreen}, the registry the emulator pane already
 * feeds for the AI assistant, rather than from a second registry or a canvas
 * handle threaded out of the pane. Its lifecycle is already the one a screenshot
 * wants: registered on the first painted frame, kept as a snapshot after Stop so
 * a halted machine still yields its last frame, and forgotten on a machine
 * change so one machine's screen can never answer for another's. The cost is a
 * decode of its base64 PNG before the enlargement can be drawn, which is
 * sub-millisecond at these resolutions.
 *
 * The scale rule and the filename are pure and DOM-free so they can be unit
 * tested; only the compose step needs a canvas.
 */

import { captureScreen } from './screenCapture';
import { downloadBlob, programNameFromFileName } from '../storage/files';
import { UNTITLED_FILE_NAME } from '../storage/settings';

/**
 * Roughly how wide a saved screenshot should be, in pixels, before rounding to a
 * whole-number enlargement. Chosen so every registered machine lands between
 * about 900 and 1300 pixels: the 256-wide Sinclairs at 4x, the 640-wide CPCs at
 * 2x, the 896-wide BBC left at 1x because it is already there.
 */
export const SCREENSHOT_TARGET_WIDTH = 1024;

/** Fallback display size, matching the emulator pane's own default. */
const DEFAULT_DISPLAY_WIDTH = 256;

/**
 * Whole-number enlargement for a machine `width` pixels across. Never below 1,
 * so a machine already wider than the target is saved at its own size rather
 * than shrunk - shrinking would resample, and square pixels are the point.
 */
export function screenshotScale(
  width: number,
  target = SCREENSHOT_TARGET_WIDTH,
): number {
  if (!Number.isFinite(width) || width <= 0) width = DEFAULT_DISPLAY_WIDTH;
  return Math.max(1, Math.round(target / width));
}

/** Two-digit zero-padded field for the filename timestamp. */
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Filename for a screenshot of the document called `fileName`.
 *
 * The program name follows the hardware exports - the uppercased, truncated stem,
 * `PROGRAM` for a document that has never been named - lowercased for a file on
 * disk. The timestamp is local time, and is what makes a second screenshot of the
 * same program a second file: unlike a `.p` or a `.wav`, where re-exporting is the
 * same artefact again, two screenshots are two different pictures, and
 * `program (1).png` is the browser losing that distinction for us.
 */
export function screenshotFileName(fileName: string, when: Date): string {
  const base =
    fileName === UNTITLED_FILE_NAME
      ? 'PROGRAM'
      : programNameFromFileName(fileName);
  const stamp =
    `${when.getFullYear()}${pad(when.getMonth() + 1)}${pad(when.getDate())}` +
    `-${pad(when.getHours())}${pad(when.getMinutes())}${pad(when.getSeconds())}`;
  return `${base.toLowerCase()}-${stamp}.png`;
}

/** What {@link saveScreenshot} did. A miss carries a reason fit to show a user. */
export type ScreenshotResult =
  | { saved: true; name: string }
  | { saved: false; reason: string };

/** Nothing has been painted yet - a reason, not an error (see below). */
const NOTHING_DRAWN =
  'The machine has not drawn anything yet, so there is no screen to save.';

/**
 * Draw the captured screen into a detached canvas at `scale`, and encode it.
 *
 * `imageSmoothingEnabled = false` is the canvas counterpart of the pane's
 * `image-rendering: pixelated`: with a whole-number scale it is what keeps each
 * machine pixel an exact block rather than a blurred one.
 */
async function composePng(
  dataUrl: string,
  width: number,
  height: number,
  scale: number,
): Promise<Blob | null> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
}

/**
 * Save the machine's current screen, naming the file after `fileName`.
 *
 * Resolves to a result rather than throwing: the toolbar wraps its actions in a
 * synchronous guard that catches into the error banner, and a rejected promise
 * would sail straight past it. "The machine has not drawn anything yet" is a
 * reason rather than an error - the capture registry simply has nothing, because
 * the pane registers only on its first painted frame.
 */
export async function saveScreenshot(
  fileName: string,
  when: Date = new Date(),
): Promise<ScreenshotResult> {
  const capture = captureScreen();
  if (!capture) return { saved: false, reason: NOTHING_DRAWN };
  try {
    const blob = await composePng(
      `data:${capture.mediaType};base64,${capture.base64}`,
      capture.width,
      capture.height,
      screenshotScale(capture.width),
    );
    if (!blob)
      return {
        saved: false,
        reason: 'The screen could not be encoded as a PNG.',
      };
    const name = screenshotFileName(fileName, when);
    downloadBlob(blob, name);
    return { saved: true, name };
  } catch (e) {
    return {
      saved: false,
      reason: `The screenshot could not be saved: ${
        e instanceof Error ? e.message : String(e)
      }`,
    };
  }
}
