import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dialects } from '../../src/dialects/registry';
import {
  bootMachine,
  configureRomRoot,
  hasRom,
  installNodeRomLoading,
} from '../../src/dialects/bootHarness';
import { hasFatalErrors } from '../../src/dialects/types';
import type {
  Dialect,
  MachineScreenText,
  TokenizeError,
} from '../../src/dialects/types';
import { HeadlessCanvas, installCanvasGlobals } from './headlessCanvas.mts';

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
      for (; frames < cap; frames++) {
        machine.runFrame();
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
      // Only when the run was bounded by the program itself: a caller who asked
      // for an exact number of frames wants that number and no more.
      if (fixed === undefined) {
        const settle = opts.settleFrames ?? SETTLE_FRAMES;
        for (let i = 0; i < settle; i++, frames++) machine.runFrame();
      }
      timings.runMs = performance.now() - runAt;

      const screen = machine.readScreenText?.() ?? null;

      let picture: RunResult['picture'] = null;
      if (opts.pixels) {
        const renderAt = performance.now();
        const canvas = new HeadlessCanvas(
          machine.displayWidth,
          machine.displayHeight,
        );
        machine.renderTo(canvas.renderContext);
        timings.renderMs = performance.now() - renderAt;
        picture = {
          width: canvas.width,
          height: canvas.height,
          rgba: canvas.rgba,
          colours: canvas.distinctColours(),
          hostFontGlyphs: canvas.hostFontGlyphs,
        };
      }

      return {
        machine: machineInfo,
        errors,
        programBytes: byteSize,
        frames,
        started,
        ended,
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
