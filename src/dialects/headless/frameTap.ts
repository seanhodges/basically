// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Sampling a run's display for something that is watching it.
 *
 * A run advances the machine as fast as the host can, so a view that took
 * every frame would spend more time compressing pictures than emulating. The
 * tap takes every Nth frame, and drops a sample whose predecessor is still on
 * its way, so what a viewer sees is the machine's present rather than a
 * backlog of its past.
 *
 * Two properties are the whole reason this is a module rather than a few lines
 * in each runner:
 *
 * - **It spends none of the machine's frames.** Painting reads the machine's
 *   current picture; it does not advance it. So every measurement taken in the
 *   machine's own time - a profile, a frame count, a variable - is the same
 *   whether or not anybody is watching.
 * - **It knows what it cost.** The tap runs from `RunObserver.frame`, which
 *   fires inside the window a runner reports as `runMs`. An unaccounted tap
 *   would make every watched run look slower than the same run unwatched, so
 *   {@link FrameTap.costMs} is accumulated for the runner to subtract.
 */

/** One sampled frame, already encoded as a picture. */
export interface ViewFrame {
  width: number;
  height: number;
  /**
   * PNG bytes. Left as bytes rather than text: they cross a thread boundary
   * before they cross anything that needs them written down, and whoever
   * writes them down knows which spelling it wants.
   */
  png: Uint8Array;
}

/** Where a tap's frames go. */
export interface FrameSink {
  /**
   * Whether anybody is watching at all. False until a view has been asked for,
   * which is most of the time, and the tap then costs a run nothing.
   */
  watching(): boolean;
  /**
   * Whether a frame handed over now would reach a viewer, rather than queue
   * behind one still on its way. A sink that says no has its sample dropped.
   */
  free(): boolean;
  /** One sampled frame of the display. */
  send(frame: ViewFrame): void;
}

/**
 * Frames between samples.
 *
 * Every machine here runs at 50 or 60Hz, so this is ten pictures a second of
 * machine time - fast enough that a keypress and the response to it are both
 * seen, and coarse enough that compressing them is a small fraction of a run.
 * A run that outpaces the sink drops samples on top of this, so the number is
 * a ceiling on the work rather than a promise about it.
 */
export const SAMPLE_EVERY_FRAMES = 5;

export interface FrameTap {
  /** One frame has run; sample it if this is the Nth and the sink is free. */
  frame(): void;
  /** The run is over: send what it left, whether or not a sample was due. */
  settle(): void;
  /** Milliseconds spent painting and encoding for the view. */
  readonly costMs: number;
}

export interface FrameTapDeps {
  sink: FrameSink;
  /**
   * Paint the display now, without charging the caller's own render clock:
   * the tap accounts for its painting itself, and a runner that folded it into
   * `renderMs` would report a figure that moved when somebody watched.
   */
  paint: () => { width: number; height: number; rgba: Uint8ClampedArray };
  encodePng: (
    rgba: Uint8ClampedArray,
    width: number,
    height: number,
  ) => Uint8Array;
  /** Frames between samples; {@link SAMPLE_EVERY_FRAMES} by default. */
  every?: number;
}

export function createFrameTap(deps: FrameTapDeps): FrameTap {
  const every = deps.every ?? SAMPLE_EVERY_FRAMES;
  let frames = 0;
  let costMs = 0;

  const sample = (): void => {
    const at = performance.now();
    const painted = deps.paint();
    deps.sink.send({
      width: painted.width,
      height: painted.height,
      png: deps.encodePng(painted.rgba, painted.width, painted.height),
    });
    costMs += performance.now() - at;
  };

  return {
    frame() {
      // Counted before the test, so the first frame of a run is sampled: a
      // viewer that has just been given an address should see something.
      if (frames++ % every !== 0) return;
      if (!deps.sink.watching() || !deps.sink.free()) return;
      sample();
    },
    // Not subject to `free`: the picture a request leaves behind is the one a
    // viewer will be looking at until the next request, so it is the one
    // sample that must not be dropped for being late.
    settle() {
      if (!deps.sink.watching()) return;
      sample();
    },
    get costMs() {
      return costMs;
    },
  };
}
