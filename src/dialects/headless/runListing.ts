import {
  bootMachine,
  configureRomRoot,
  canRunMachine,
  installNodeRomLoading,
} from '../bootHarness';
import { hasFatalErrors } from '../types';
import type { MachineScreenText } from '../types';
import { resolveTokenize } from '../resolveListing';
import { findMachine } from '../machineLookup';
import { HeadlessCanvas, installCanvasGlobals } from './headlessCanvas';
import { RunError } from './runError';
import { findRomRoot } from './romRoot';
import type { RunOptions, RunResult, RunTimings } from './runTypes';

/**
 * Run a BASIC listing on a registered machine under node and report its screen.
 *
 * The whole of the IDE's run path except the browser: tokenize the source,
 * construct the dialect's emulator on its committed ROM, hand it the image, and
 * read back what it drew - as the characters the machine says are on screen, as
 * the pixels it painted, or both.
 *
 * Nothing here touches `process`, argv or the filesystem beyond the ROMs: the
 * caller owns its own input and output, so a command line and a server can each
 * wrap this without either inheriting the other's shape.
 */

/** A program that has begun cannot un-begin, so a `false` ends the run. */
const DEFAULT_MAX_FRAMES = 4000;

/**
 * Frames run after the program stops, before the screen is read.
 *
 * BASIC stopping and the picture showing what it printed are not the same
 * moment: several machines paint a frame progressively - the C64's video host
 * writes it a pixel at a time, the Spectrums a scanline at a time - so the
 * frame in flight when the program ended is part-drawn, and its last printed
 * line is missing from the picture the seam hands back. Two whole frames after
 * the fact settle every machine here; the second is margin, not a measurement.
 */
const SETTLE_FRAMES = 2;

export { RunError } from './runError';

// Re-exported so the callers that already asked this module keep working; the
// answer itself lives in a leaf, out of reach of the emulators below.
export { findRomRoot } from './romRoot';

// The same, for the shape of a run: it is declared in a leaf so a caller can
// name it without naming this module, and re-exported so the callers that
// already ask this one keep working.
export type {
  RunFrame,
  RunObserver,
  RunOptions,
  RunResult,
  RunTimings,
} from './runTypes';

// Re-exported for the CLI modules that already import these from here.
export { findMachine, machineList } from '../machineLookup';

export async function runListing(opts: RunOptions): Promise<RunResult> {
  const dialect = findMachine(opts.machine);
  if (!dialect) throw new RunError(`no registered machine "${opts.machine}"`);
  // Set even when nothing was found: the root is a global and a host serves
  // many calls, so a previous call's directory must not linger into this one.
  configureRomRoot(opts.romRoot ?? findRomRoot());

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
    canRun: canRunMachine(dialect),
  };
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

  const restoreRoms = installNodeRomLoading();
  const restoreCanvas = installCanvasGlobals();
  try {
    const bootAt = performance.now();
    const machine = await bootMachine(dialect);
    timings.bootMs = performance.now() - bootAt;
    machineInfo.displayWidth = machine.displayWidth;
    machineInfo.displayHeight = machine.displayHeight;
    machineInfo.frameHz = machine.frameHz;

    try {
      const loadAt = performance.now();
      machine.loadProgram(image);
      // The Acorn, Atom and Commodore machines queue their boot-and-inject on a
      // microtask; let it land before the first frame.
      await new Promise((r) => setTimeout(r, 0));
      timings.loadMs = performance.now() - loadAt;
      const observe = opts.observe;
      observe?.loaded?.(machine);
      const runFrame = () => {
        machine.runFrame();
        observe?.frame?.(machine);
      };

      const runAt = performance.now();
      const fixed = opts.frames;
      // A driven run's own loop runs only what the caller asked for on top of
      // the schedule: the schedule already said how long to let the program
      // run, and waiting for a game to end after it would pay the whole cap.
      const cap = opts.drive
        ? (fixed ?? 0)
        : (fixed ?? opts.maxFrames ?? DEFAULT_MAX_FRAMES);
      let started = false;
      let ended = false;
      let frames = 0;
      let driveFrames = 0;
      // One canvas for the whole run: the predicate paints into it and, when it
      // stops the run, what it saw is what comes back - so the result is the
      // frame the predicate accepted rather than another one taken later.
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

      // Sampled per frame while a schedule is running, the same tri-state way
      // the undriven loop samples it: a program cannot un-begin, so once it has
      // been seen running and then stopped, it has ended - and a schedule whose
      // last action was WAIT END is exactly the run that reaches that.
      const sample = () => {
        const running = machine.isProgramRunning();
        if (running === true) started = true;
        if (running === false && started) ended = true;
      };
      if (opts.drive) {
        opts.drive(machine, () => {
          runFrame();
          driveFrames++;
          sample();
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
        // The same yield the shared boot harness makes: the ROM loads several
        // machines start in their constructors settle on timers, and a tight
        // synchronous loop never lets them land.
        if (frames % 20 === 0) await new Promise((r) => setTimeout(r, 0));
      }
      // Settling is for a run the program itself ended: the frame in flight when
      // it stopped is part-drawn. A predicate stop needs none - it already named
      // the frame it wanted - and running on past it would be actively wrong,
      // since a blinking or looping screen is a different picture two frames
      // later. A caller who asked for an exact count wants that count and no
      // more either.
      const settled = !reached || opts.until === undefined;
      // A driven run settles only where the program actually stopped: the
      // caller's own frame count is exact, and a schedule that left a game
      // running has no settled picture to wait for.
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
        // Repainted only when the run moved on since the predicate last looked.
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
    } finally {
      machine.dispose();
    }
  } finally {
    restoreCanvas();
    restoreRoms();
  }
}

/** Screen text as lines, with the blank rows under the program trimmed off. */
export { screenLines } from './screenText';
