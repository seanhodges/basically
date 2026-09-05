// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The one machine the server holds, and the runner that puts a program on it.
 *
 * A run on the command line boots a machine, reports its screen and lets it go,
 * because an invocation ends. A server does not end, so what the assistant is
 * given by the IDE - a machine that is already up, driven a step at a time - is
 * what this gives an agent: the run leaves the machine running, and every later
 * request acts on it.
 *
 * This is a {@link ListingRunner} of its own rather than a change to
 * `src/dialects/headless/runListing.ts`, because that runner disposes the
 * machine in a `finally` and the command line depends on it doing so. What it
 * shares is the pieces underneath - the ROM and canvas stand-ins, the boot, the
 * tokenizer, the headless session - so the machine an agent drives here is the
 * machine a `basically run` would have booted.
 *
 * Two facts about a machine outside a browser shape the rest:
 *
 * - The stand-ins are installed on the process, not on the machine, so a second
 *   set nested inside the first would be restored in the wrong order. One
 *   machine is held at a time and running a second program lets the first go.
 * - Nothing advances the machine between requests. Frames are spent by the
 *   requests that ask for them, so a client that pauses for an hour returns to
 *   the frame it left, and every measurement stays in the machine's own time.
 */

import { RunMeasurements } from '../app/runMeasurements';
import type { MachineSession } from '../app/machineSession';
import {
  bootMachine,
  configureRomRoot,
  hasRom,
  installNodeRomLoading,
} from '../dialects/bootHarness';
import {
  encodePng,
  HeadlessCanvas,
  installCanvasGlobals,
} from '../dialects/headless/headlessCanvas';
import { RunError } from '../dialects/headless/runError';
import {
  findRomRoot,
  type RunOptions,
  type RunResult,
  type RunTimings,
} from '../dialects/headless/runListing';
import { findMachine } from '../dialects/machineLookup';
import { resolveTokenize } from '../dialects/resolveListing';
import { hasFatalErrors } from '../dialects/types';
import type {
  Dialect,
  MachineEmulator,
  MachineScreenText,
} from '../dialects/types';
import { createHeadlessSession } from '../ops/headlessSession';
import type { ListingRunner } from '../ops/types';

/** Cap on the wait for a program to end, when the caller names none. */
const DEFAULT_MAX_FRAMES = 4000;

/**
 * Frames run after the program stops, before the screen is read.
 *
 * BASIC stopping and the picture showing what it printed are not the same
 * moment: several machines paint a frame progressively, so the frame in flight
 * when the program ended is part-drawn and its last printed line is missing.
 * Two whole frames settle every machine here; the second is margin.
 */
const SETTLE_FRAMES = 2;

/** The machine that is up, and everything a later request reads from it. */
export interface HeldMachine {
  dialect: Dialect;
  machine: MachineEmulator;
  /** What every operation needing a machine is given.  */
  session: MachineSession;
}

/**
 * The server's machine: at most one, held until another program replaces it or
 * the client goes away.
 */
export interface ServerMachine {
  /** The machine that is up, or null when none is. */
  held(): HeldMachine | null;
  /** The session an operation needing a machine is given, or null. */
  session(): MachineSession | null;
  /** Run a program, leaving the machine it ran on up. */
  run: ListingRunner;
  /** Let go of whatever is held; safe to call when nothing is. */
  dispose(): void;
}

export function createServerMachine(): ServerMachine {
  /** The process-wide stand-ins come off in the order they went on. */
  let held: (HeldMachine & { restore: (() => void)[] }) | null = null;

  function dispose(): void {
    if (!held) return;
    const { machine, restore } = held;
    held = null;
    machine.dispose();
    for (const undo of restore.reverse()) undo();
  }

  const run: ListingRunner = async (opts: RunOptions): Promise<RunResult> => {
    const dialect = findMachine(opts.machine);
    if (!dialect) throw new RunError(`no registered machine "${opts.machine}"`);
    const romRoot = opts.romRoot ?? findRomRoot();
    if (romRoot) configureRomRoot(romRoot);

    const startedAt = performance.now();
    const timings: RunTimings = {
      bootMs: 0,
      tokenizeMs: 0,
      loadMs: 0,
      runMs: 0,
      renderMs: 0,
      totalMs: 0,
    };

    const tokenizeAt = performance.now();
    const { image, errors, byteSize } = resolveTokenize(dialect, opts.source);
    timings.tokenizeMs = performance.now() - tokenizeAt;

    const machineInfo = {
      id: dialect.id,
      name: dialect.name,
      manufacturer: dialect.manufacturer,
      displayWidth: 0,
      displayHeight: 0,
      frameHz: 0,
      romPresent: hasRom(dialect),
    };
    // A program that cannot run leaves whatever was up exactly as it was:
    // nothing was replaced, because nothing was booted.
    const refused = (): RunResult => ({
      machine: machineInfo,
      errors,
      programBytes: byteSize,
      frames: 0,
      driveFrames: 0,
      started: false,
      ended: false,
      reached: false,
      screen: null,
      picture: null,
      timings: { ...timings, totalMs: performance.now() - startedAt },
    });
    if (hasFatalErrors(errors)) return refused();
    if (image.length === 0) {
      errors.push({ line: 1, message: 'Program is empty' });
      return refused();
    }

    // The machine that was up goes before the next one arrives, so the
    // stand-ins are never installed twice over.
    dispose();
    const restore = [installNodeRomLoading(), installCanvasGlobals()];

    let machine: MachineEmulator;
    try {
      const bootAt = performance.now();
      machine = await bootMachine(dialect);
      timings.bootMs = performance.now() - bootAt;
    } catch (error) {
      for (const undo of restore.reverse()) undo();
      throw error;
    }
    machineInfo.displayWidth = machine.displayWidth;
    machineInfo.displayHeight = machine.displayHeight;
    machineInfo.frameHz = machine.frameHz;

    const loadAt = performance.now();
    machine.loadProgram(image);
    // The Acorn, Atom and Commodore machines queue their boot-and-inject on a
    // microtask; a screen read before it lands is an empty one.
    await new Promise((r) => setTimeout(r, 0));
    timings.loadMs = performance.now() - loadAt;

    // Exactly one fold over the run, armed before the first frame. Exactly
    // one because draining a machine's per-line costs takes them: a second
    // folder would see what the first left, which is nothing. So the server
    // measures every run it holds, and an operation asking for a measurement
    // reads it off the machine that is still up rather than folding again.
    const measurements = new RunMeasurements(null, opts.source);
    measurements.arm(machine);

    // One canvas for as long as the machine is up: painting into it again
    // reads the machine's picture now, which is what a later request wants.
    let canvas: HeadlessCanvas | null = null;
    let renderMs = 0;
    const paint = (): HeadlessCanvas => {
      const at = performance.now();
      canvas ??= new HeadlessCanvas(
        machine.displayWidth,
        machine.displayHeight,
      );
      machine.renderTo(canvas.renderContext);
      renderMs += performance.now() - at;
      return canvas;
    };

    const observe = opts.observe;
    const runFrame = () => {
      machine.runFrame();
      measurements.frame(machine);
      observe?.frame?.(machine);
    };
    observe?.loaded?.(machine);

    const runAt = performance.now();
    const fixed = opts.frames;
    // A driven run runs only what the caller asked for on top of the schedule:
    // the schedule already said how long to let the program run.
    const cap = opts.drive
      ? (fixed ?? 0)
      : (fixed ?? opts.maxFrames ?? DEFAULT_MAX_FRAMES);
    let started = false;
    let ended = false;
    let frames = 0;
    let driveFrames = 0;

    // Sampled the same tri-state way throughout: a program cannot un-begin, so
    // once it has been seen running and then stopped, it has ended.
    const sample = () => {
      const running = machine.isProgramRunning();
      if (running === true) started = true;
      if (running === false && started) ended = true;
    };

    const step = () => {
      runFrame();
      sample();
    };

    held = {
      dialect,
      machine,
      restore,
      session: createHeadlessSession({
        machine,
        dialect,
        step,
        source: opts.source,
        measurements,
        paint: () => {
          const painted = paint();
          return {
            width: painted.width,
            height: painted.height,
            rgba: painted.rgba,
          };
        },
        encodePng,
      }),
    };

    if (opts.drive) {
      opts.drive(machine, () => {
        step();
        driveFrames++;
      });
      frames += driveFrames;
    }

    let reached = opts.until === undefined;
    let lastScreen: MachineScreenText | null = null;
    for (; frames < driveFrames + cap; frames++) {
      runFrame();
      if (opts.drive) sample();
      if (opts.until !== undefined) {
        lastScreen = machine.readScreenText?.() ?? null;
        reached = opts.until({
          screen: lastScreen,
          colours: () => paint().distinctColours(),
        });
        if (reached) {
          frames++;
          break;
        }
      }
      if (fixed === undefined) {
        // Tri-state: null until the machine has taken the program, so a
        // `false` can only mean a program that started and then stopped.
        const running = machine.isProgramRunning();
        if (running === true) started = true;
        if (running === false) {
          ended = true;
          frames++;
          break;
        }
      }
      // The same yield the boot harness makes: the ROM loads several machines
      // start in their constructors settle on timers, and a tight synchronous
      // loop never lets them land.
      if (frames % 20 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    // Settling is for a run the program itself ended; a predicate stop already
    // named the frame it wanted, and an exact count is exact.
    const settled = !reached || opts.until === undefined;
    const settling = opts.drive ? ended : fixed === undefined;
    if (settling && settled) {
      const settle = opts.settleFrames ?? SETTLE_FRAMES;
      for (let i = 0; i < settle; i++, frames++) runFrame();
    }
    timings.runMs = performance.now() - runAt;

    const screen =
      opts.until !== undefined && reached && !settled
        ? lastScreen
        : (machine.readScreenText?.() ?? null);

    let picture: RunResult['picture'] = null;
    if (opts.pixels || canvas) {
      const painted = canvas && !settled ? canvas : paint();
      timings.renderMs = renderMs;
      picture = {
        width: painted.width,
        height: painted.height,
        rgba: painted.rgba,
        colours: painted.distinctColours(),
        hostFontGlyphs: painted.hostFontGlyphs,
      };
    }

    // The machine is still up, which is the whole point; the observer is told
    // the run is over on the same terms the one-shot runner tells it.
    await observe?.finished?.(machine);

    return {
      machine: machineInfo,
      errors,
      programBytes: byteSize,
      frames,
      driveFrames,
      started,
      ended,
      reached,
      screen,
      picture,
      timings: { ...timings, totalMs: performance.now() - startedAt },
    };
  };

  return {
    held: () => held,
    session: () => held?.session ?? null,
    run,
    dispose,
  };
}
