import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dialects } from '../registry';
import {
  bootMachine,
  configureRomRoot,
  hasRom,
  installNodeRomLoading,
} from '../bootHarness';
import { hasFatalErrors } from '../types';
import type { Dialect, MachineScreenText, TokenizeError } from '../types';
import { HeadlessCanvas, installCanvasGlobals } from './headlessCanvas';

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
  /** Frames to run after the program stops; see {@link SETTLE_FRAMES}. */
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
  /** Paint the machine's picture as well as reading its screen text. */
  pixels?: boolean;
  /** `public/` to read the ROMs from; discovered by {@link findRomRoot} when absent. */
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
    /** Whether this checkout carries the machine's ROM at all. */
    romPresent: boolean;
  };
  /** Tokenizer diagnostics; a fatal one means nothing ran. */
  errors: TokenizeError[];
  /** Size of the tokenized program, as the RAM budget counts it. */
  programBytes: number;
  frames: number;
  /** Whether the machine was ever seen running the program, and then stopped. */
  started: boolean;
  ended: boolean;
  /** Whether {@link RunOptions.until} held before the cap; true when unused. */
  reached: boolean;
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

/**
 * The `public/` holding the ROMs, found by walking up from this code and then
 * from the working directory.
 *
 * Bundled, this module has no idea where the checkout is - its own path is
 * wherever the bundle was written - so the directory is searched for rather
 * than derived. Returns null when there is none, which is a machine that draws
 * its missing-image notice rather than a failure.
 */
export function findRomRoot(): string | null {
  const starts = [path.dirname(fileURLToPath(import.meta.url)), process.cwd()];
  for (const start of starts) {
    for (let dir = start; ; dir = path.dirname(dir)) {
      const candidate = path.join(dir, 'public');
      if (existsSync(path.join(candidate, 'roms'))) return candidate;
      if (path.dirname(dir) === dir) break;
    }
  }
  return null;
}

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

/** Thrown for the two things a caller gets wrong, as against a bad program. */
export class RunError extends Error {}

/** Resolve a dialect by id or by the name the machine picker shows. */
export function findMachine(name: string): Dialect | undefined {
  const wanted = name.trim().toLowerCase();
  return (
    dialects.find((d) => d.id === name) ??
    dialects.find((d) => d.id.toLowerCase() === wanted) ??
    dialects.find((d) => d.name.toLowerCase() === wanted)
  );
}

/** Every registered machine, in registry order. */
export function machineList(): { id: string; name: string; blurb: string }[] {
  return dialects.map((d) => ({ id: d.id, name: d.name, blurb: d.blurb }));
}

export async function runListing(opts: RunOptions): Promise<RunResult> {
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
  const { image, errors, byteSize } = dialect.tokenize(opts.source);
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
  const refused = (): RunResult => ({
    machine: machineInfo,
    errors,
    programBytes: byteSize,
    frames: 0,
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

      const runAt = performance.now();
      const fixed = opts.frames;
      const cap = fixed ?? opts.maxFrames ?? DEFAULT_MAX_FRAMES;
      let started = false;
      let ended = false;
      let frames = 0;
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

      let reached = opts.until === undefined;
      let lastScreen: MachineScreenText | null = null;
      for (; frames < cap; frames++) {
        machine.runFrame();
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
      if (fixed === undefined && settled) {
        const settle = opts.settleFrames ?? SETTLE_FRAMES;
        for (let i = 0; i < settle; i++, frames++) machine.runFrame();
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

      return {
        machine: machineInfo,
        errors,
        programBytes: byteSize,
        frames,
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
export function screenLines(screen: MachineScreenText | null): string[] {
  if (!screen) return [];
  const lines = screen.lines.map((line) => line.replace(/\s+$/, ''));
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}
