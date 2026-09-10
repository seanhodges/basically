// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * A played machine's display, on its way to whoever is playing it.
 *
 * A view samples a fraction of the frames and can afford to encode each as a
 * picture. Playing takes all of them, and the two things that made a picture
 * affordable at a tenth of the rate are exactly what make it unaffordable at
 * the whole of it. So a frame is its raw pixels through raw deflate at the
 * cheapest level, which on the widest display among the registered machines
 * costs about a tenth of what encoding a picture does and leaves the frame
 * comfortably inside its own period.
 *
 * Two economies before the deflate, and the first is the larger:
 *
 * - **A frame identical to the one before it is not sent at all.** Found by
 *   comparing the raw pixels rather than by compressing them and comparing the
 *   result: the comparison costs a fifth of what the deflate does, and at a
 *   `READY` prompt seven frames in eight are identical.
 * - **A frame handed over while the far end is behind is dropped**, which the
 *   channel decides rather than this module - what a player sees has to be the
 *   machine's present rather than an accumulating past.
 *
 * The width and the height travel with every frame rather than once at the
 * start: a program that reprograms its machine's display registers changes both
 * mid-run, and a page told the size once would draw the rest of the session
 * into the wrong box.
 */

import { deflateRawSync } from 'node:zlib';

/**
 * The deflate level.
 *
 * One rather than the default six: the pixels of a blocky two- or sixteen-
 * colour display compress hard at any level, and the levels above this buy a
 * few percent of the bytes for several times the milliseconds - out of a budget
 * measured against the machine's own frame period.
 */
const DEFLATE_LEVEL = 1;

/** One frame of a played machine's display, ready to be written to a socket. */
export interface PlayFrame {
  width: number;
  height: number;
  /** The display's pixels, raw-deflated. */
  pixels: Uint8Array;
}

/**
 * Encode frames for one channel, skipping the ones that changed nothing.
 *
 * Stateful because "changed nothing" is a question about the frame before, and
 * per channel because a channel that has just been opened must be sent a frame
 * even if the machine has been showing it for an hour.
 */
export interface PlayFrames {
  /**
   * The frame to send, or null when this one is the last one over again.
   *
   * The size changing always sends, whatever the pixels say: a page that was
   * told 320x200 and is now being sent 640x200 has to hear about it.
   */
  encode(
    rgba: Uint8ClampedArray,
    width: number,
    height: number,
  ): PlayFrame | null;
  /** Forget what was last sent, so the next frame is sent whatever it shows. */
  reset(): void;
}

export function createPlayFrames(): PlayFrames {
  let previous: Buffer | null = null;
  let size = '';

  return {
    encode(rgba, width, height) {
      // A view over the same memory rather than a copy: the deflate reads it
      // and the comparison reads it, and neither keeps it.
      const raw = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.length);
      const shape = `${width}x${height}`;
      if (shape === size && previous && previous.equals(raw)) return null;
      size = shape;
      previous = Buffer.from(raw);
      return {
        width,
        height,
        pixels: deflateRawSync(raw, { level: DEFLATE_LEVEL }),
      };
    },
    reset() {
      previous = null;
      size = '';
    },
  };
}
