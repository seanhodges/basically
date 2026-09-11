// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * What a headless run is asked for and what it reports back.
 *
 * Apart from `runListing.ts`, which performs one, because describing a runner
 * and being one are different jobs: `src/ops/types.ts` names this shape in
 * `ListingRunner` so that an operation can be handed a runner without the
 * operation layer naming node - and the command line's runner and the
 * held-machine session are two things that satisfy it. The runner reaches the
 * boot harness, the headless canvas and the ROM cache below it, so a module
 * that only wants the contract must not name the runner to get it;
 * `src/build/webBoundary.test.ts` walks the app's imports and fails when one
 * does, type-only imports included.
 *
 * Nothing here but types over the `Dialect` seam: no node, no DOM.
 */

import type { FrameSink } from './frameTap';
import type {
  MachineEmulator,
  MachineScreenText,
  TokenizeError,
} from '../types';

/** One frame, as {@link RunOptions.until} sees it. */
export interface RunFrame {
  /** The characters the machine says are on screen, or null if it cannot say. */
  screen: MachineScreenText | null;
  /**
   * Distinct colours in this frame, painting it if the caller asks. One means
   * a flat screen; more than one is the headless reading of "it has drawn
   * something", which is what the browser check this replaces polled for.
   */
  colours: () => number;
}

/**
 * A caller watching a run from the outside: told when the program is loaded,
 * after every frame, and once the run is over while the machine is still up.
 *
 * The runner hands over the machine and nothing else - it is told nothing
 * about measurements, sessions or schedules, which is what keeps this folder
 * free of `src/app/` and of the operation layer. Every frame the runner spends
 * is reported, including the frames a {@link RunOptions.drive} hook steps and
 * the settling frames after the program stops, so an observer folding
 * measurements sees the same frames the browser's run loop would.
 */
export interface RunObserver {
  /** The image is loaded and the machine is about to run its first frame. */
  loaded?(machine: MachineEmulator): void;
  /** One frame has run. */
  frame?(machine: MachineEmulator): void;
  /**
   * The run is over and its screen read; the machine is still alive and is
   * disposed once this settles.
   */
  finished?(machine: MachineEmulator): void | Promise<void>;
}

export interface RunOptions {
  /** A dialect id, or a machine name; matched case-insensitively. */
  machine: string;
  /** The BASIC listing. */
  source: string;
  /**
   * Run exactly this many frames rather than waiting for the program to end.
   * The answer for a program that never ends - a game loop - and the only way
   * to see a machine part-way through one.
   */
  frames?: number;
  /** Cap on the wait for a program to end. */
  maxFrames?: number;
  /** Frames to run after the program stops, settling its picture. */
  settleFrames?: number;
  /**
   * Stop at the first frame this holds of, rather than waiting for the program
   * to end.
   *
   * Wanted because a program that never ends is not the only thing a frame
   * count reads wrong: a program that loops over a screen it keeps clearing has
   * no single settled picture, so any fixed number lands on an arbitrary moment
   * of the animation - blank as often as not. A predicate names the moment
   * instead, and costs nothing on a machine that reaches it in a few frames.
   *
   * The frame is handed over with its picture behind a call rather than a
   * value, because painting one costs more than reading the characters and a
   * predicate that only wants the characters should not pay for it.
   */
  until?: (frame: RunFrame) => boolean;
  /**
   * Act on the machine once the program is loaded, before the runner's own
   * loop: `step` advances one frame, and every frame it spends is counted into
   * {@link RunResult.driveFrames}.
   *
   * The runner is handed a machine and a clock and is told nothing about what a
   * schedule is - which is what keeps `src/dialects/headless/` free of
   * `src/app/` and keeps the runner's promise of touching nothing but ROMs.
   *
   * When a hook is given, the run ends where the hook left it: its own waits
   * already said how long to let the program run, and the screen the caller
   * wants is the one the last action reached. A game never ends, so waiting for
   * the program afterwards would pay the whole cap and then read an arbitrary
   * later frame. `frames` still runs that many more, for the game that needs a
   * moment to draw after the key.
   */
  drive?: (machine: MachineEmulator, step: () => void) => void;
  /** Watch the run; see {@link RunObserver}. */
  observe?: RunObserver;
  /**
   * Where sampled frames of this run's display go, for something projecting
   * the machine to a view; see {@link FrameSink}.
   *
   * Sampling paints the machine and never advances it, so a watched run is the
   * same run: the frames it spends, and every measurement counted in them, do
   * not move. What the tap costs the host is measured and taken back out of
   * {@link RunTimings.runMs}, so the reported time does not move either.
   */
  view?: FrameSink;
  /**
   * BASIC line numbers this run is to stop before.
   *
   * Breakpoints have to be in place before the program starts or the program is
   * over before anyone could set one, so the run is where the first ones arrive;
   * changing them between stops is the held machine's business rather than a
   * run's. Naming any has the run take the machine's own stopping path in place
   * of a plain frame advance, and a run that stopped reports
   * {@link RunResult.stoppedAt} and leaves the machine there rather than
   * settling its picture past the stop. A machine that cannot say which BASIC
   * line it is executing takes the ordinary path whatever is named here; whether
   * it can be stepped is asked of the machine before a run is started, not
   * discovered afterwards.
   */
  breakpoints?: readonly number[];
  /** Paint the machine's picture as well as reading its screen text. */
  pixels?: boolean;
  /** `public/` to read the ROMs from; the runner finds one when absent. */
  romRoot?: string;
}

export interface RunTimings {
  /** Constructing the machine and waiting for its ROMs. */
  bootMs: number;
  /** Text to a loadable image. */
  tokenizeMs: number;
  /** Handing the machine the image, which boots its ROM and types at it. */
  loadMs: number;
  /** Running frames. */
  runMs: number;
  /** One `renderTo`. */
  renderMs: number;
  totalMs: number;
}

export interface RunResult {
  machine: {
    id: string;
    name: string;
    manufacturer: string;
    displayWidth: number;
    displayHeight: number;
    frameHz: number;
    /** Whether this installation can run the machine at all. */
    canRun: boolean;
  };
  /** Tokenizer diagnostics; a fatal one means nothing ran. */
  errors: TokenizeError[];
  /** Size of the tokenized program, as the RAM budget counts it. */
  programBytes: number;
  frames: number;
  /** Of those, the frames {@link RunOptions.drive} spent. */
  driveFrames: number;
  /** Whether the machine was ever seen running the program, and then stopped. */
  started: boolean;
  ended: boolean;
  /** Whether {@link RunOptions.until} held before the cap; true when unused. */
  reached: boolean;
  /**
   * The BASIC line the run stopped before, or null when it did not stop.
   *
   * The third way a run can finish, beside reaching the end of its program and
   * using up the frames it was given, and told apart from both structurally
   * rather than in prose: a caller that ignores this reports a run that is still
   * going, which is true.
   */
  stoppedAt: number | null;
  screen: MachineScreenText | null;
  /** The painted frame, when `pixels` was asked for. */
  picture: {
    width: number;
    height: number;
    rgba: Uint8ClampedArray;
    /** Distinct colours in the frame - one means nothing was drawn. */
    colours: number;
    /**
     * Glyphs drawn in the stand-in font. Non-zero means this machine paints
     * text through the host's font, so the picture is legible rather than
     * faithful; zero means it is the frame a browser would show.
     */
    hostFontGlyphs: number;
  } | null;
  timings: RunTimings;
}
