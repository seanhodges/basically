/**
 * A debug slice is a frame.
 *
 * `shouldOpenDebugSession` returns true for every dialect that models line
 * debugging, so an ordinary press of Play opens a session and the run loop
 * advances the machine by `debugStep` rather than `runFrame` - for most of the
 * registry, the debug path *is* the normal path. The loop drives both from one
 * clock, for the same number of steps, and calls the same things after each:
 * the virtual keyboard's frame hook, the profiler, the audio drain. So a slice
 * owes a frame's worth of everything, and the only thing it may do differently
 * is stop early to pause.
 *
 * Machines have broken that three separate ways, each of which looked like an
 * unrelated bug until it was traced back here:
 *
 *  - the PMD 85's slice stepped the CPU itself and never reached the profiler's
 *    charge, so a run measured nothing;
 *  - the same slice left the free-running cycle counter alone, and the speaker
 *    and tape deck both read themselves against it, so a run was silent;
 *  - the BBC's slice never caught its sound chip up, and the chip is only
 *    otherwise advanced when the OS pokes a register, so a held note came out
 *    as silence followed by a burst of its own backlog.
 *
 * One boot per machine rather than the two `profileTransparency.test.ts` takes:
 * this compares a machine against itself, so it needs a window of frames and a
 * window of slices on one already-running loop rather than two runs to
 * completion. Registry-driven, so a machine added later is covered the day it
 * declares a stepper.
 *
 * The picture is in scope too, through the headless canvas in
 * `headless/headlessCanvas`. It is worth checking separately from the cycle
 * count because painting is not always on the path a cycle takes: the machines
 * that hand the shared loop a `renderFrame` do it from `onSliceEnd`, and one
 * that painted from its `runFrame` instead would keep perfect time and still
 * show a frozen screen to anyone stepping it. So each window is fingerprinted
 * either side and the two paths must agree on whether the picture moved.
 *
 * What that still cannot see is the *phase* of a counter that only the picture
 * reads - the PMD 85's blink attribute divides its frame count, and a slice
 * that advanced the count by the wrong amount would repaint either way. That
 * needs a machine with a blink attribute to test against, so it stays pinned
 * where the attribute is, in `pmd85/emulator/pmd85Machine.test.ts`.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { dialects } from './registry';
import {
  bootMachine,
  installNodeRomLoading,
  runFrames,
  runUntil,
} from './bootHarness';
import {
  HeadlessCanvas,
  installCanvasGlobals,
} from './headless/headlessCanvas';
import type { MachineEmulator } from './types';

/** Booting the real ROMs dominates every case here (see c64Machine.test.ts). */
const BOOT_TIMEOUT_MS = 60_000;

/**
 * Prints as it counts, so the loop keeps the ROM busy doing something a machine
 * would ordinarily be doing - a bare arithmetic loop touches neither the screen
 * driver nor, on the Acorns, the sound chip's scheduler.
 */
const PROBE = '10 FOR I=1 TO 40\n20 PRINT I;\n30 NEXT I\n40 GOTO 10\n';

/** Frames given to reach the loop; the slowest ROM boot plus its injected RUN. */
const SETTLE_FRAMES = 400;

/**
 * Frames, then slices, in each measured window. Long enough that a window's
 * ragged edges - a part-slice held by the profiler, a sound buffer that fills
 * every few frames - cannot swing the comparison.
 */
const WINDOW = 60;

/**
 * How far the two windows may differ, as a fraction.
 *
 * Not equality: a slice advances *up to* a frame's budget, the profiler holds
 * back a part-slice at each drain, and a sound chip hands over whole buffers
 * rather than exact frames. Measured across the registry the two windows agree
 * to within a few dozen cycles in several million - about a thousandth of a
 * percent - so a few percent is loose enough never to be flaky and still tight
 * enough to catch a slice that advances most of a frame rather than all of it,
 * which a "greater than zero" check would wave through.
 */
const TOLERANCE = 0.05;
/** Audio is chunked more coarsely than cycles, so it gets a wider band. */
const AUDIO_TOLERANCE = 0.1;

/**
 * Machines whose debug path is not held to this, and why.
 *
 * Empty, and that is the point: every machine that can be stepped owes a frame
 * per slice. An entry here would have to name something a slice genuinely
 * cannot do, which no machine has yet needed - and the crosscheck below keeps
 * a stale one from outliving its reason.
 */
const NO_DEBUG_PARITY: Record<string, string> = {};

/**
 * Machines whose picture is already still by the time the windows run, and why.
 *
 * The probe prints until the screen is full, and these ROMs stop when it is:
 * the Spectrums and the SAM park at `scroll?` waiting for a key, and the ZX80
 * gives up with report 5 at line 20. A still screen is the same picture at both
 * ends of either window, so there is nothing for the two to disagree about -
 * and naming them is better than a longer window, which cannot help when the
 * machine is waiting for a key that never comes. The ZX81 is not among them:
 * it is slow enough that a window ends mid-screen with the ROM still printing.
 *
 * The picture assertions read this both ways, so an entry cannot go stale
 * quietly: a machine listed here that starts repainting fails just as one
 * missing from it that stops.
 */
const STILL_SCREEN: Record<string, string> = {
  zx80: 'stops with report 5 at line 20 once the screen is full',
  zxspectrum: 'waits at the scroll? prompt once the screen is full',
  zxspectrum128: 'waits at the scroll? prompt once the screen is full',
  samcoupe: 'waits at the scroll? prompt once the screen is full',
};

/** Machines with no stepper at all sit this out; that is a different fact. */
function steppable(machine: MachineEmulator): boolean {
  return typeof machine.debugStep === 'function';
}

/** How far apart two readings of the same thing are, as a fraction. */
function relative(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(b, 1);
}

/**
 * Whether a window's audio is a stream rather than a stray transient: most of
 * the samples the machine's own declared rate says a window of frames holds.
 */
function streaming(machine: MachineEmulator, samples: number): boolean {
  const perFrame = (machine.audioSampleRate ?? 0) / machine.frameHz;
  return perFrame > 0 && samples >= WINDOW * perFrame * 0.5;
}

/** What one window of advancing the machine produced. */
interface Window {
  /** Cycles the machine charged to the lines that ran, if it charges any. */
  cycles: number;
  /** Audio samples it synthesized, if it synthesizes any. */
  samples: number;
  /** Whether it still reported the program running at the end of the window. */
  running: boolean | null;
  /** Whether it could still name the line it was on. */
  named: boolean;
  /** Whether the picture at the end of the window differs from the one before it. */
  repainted: boolean;
  /** Distinct colours in the picture at the end - one is a blank screen. */
  colours: number;
}

/**
 * A digest of a painted frame, over every byte of it.
 *
 * Sampling a stride is the obvious economy and it is wrong here: the smallest
 * change this has to see is one character, which on a 256x192 screen is eight
 * runs of a few dozen bytes, and a stride wide enough to be worth taking misses
 * it often enough to make the comparison a coin toss. The ZX81 found this - it
 * is the slowest BASIC in the registry, so a window of it is a character or two
 * rather than a scroll. Every byte of a frame is a few hundred thousand, four
 * times per machine, which is nothing next to booting one.
 */
function fingerprint(rgba: Uint8ClampedArray): number {
  let hash = 0;
  for (let i = 0; i < rgba.length; i++) hash = (hash * 31 + rgba[i]!) | 0;
  return hash;
}

/** Paint the machine's current frame into `canvas` and digest it. */
function paint(machine: MachineEmulator, canvas: HeadlessCanvas): number {
  machine.renderTo(canvas.renderContext);
  return fingerprint(canvas.rgba);
}

/** Drain everything the machine accumulated, so a window starts from nothing. */
function drain(machine: MachineEmulator): void {
  machine.drainProfile?.();
  machine.readAudio?.();
}

function measured(
  machine: MachineEmulator,
  canvas: HeadlessCanvas,
  cycles: number,
  samples: number,
  before: number,
): Window {
  return {
    cycles,
    samples,
    running: machine.isProgramRunning(),
    named: machine.currentLine?.() !== null,
    repainted: paint(machine, canvas) !== before,
    colours: canvas.distinctColours(),
  };
}

/** A window of ordinary frames. */
async function frameWindow(
  machine: MachineEmulator,
  canvas: HeadlessCanvas,
): Promise<Window> {
  drain(machine);
  const before = paint(machine, canvas);
  let samples = 0;
  await runUntil(
    machine,
    () => false,
    WINDOW,
    () => {
      samples += machine.readAudio?.().length ?? 0;
    },
  );
  const costs = machine.drainProfile?.() ?? [];
  return measured(
    machine,
    canvas,
    costs.reduce((sum, c) => sum + c.cost, 0),
    samples,
    before,
  );
}

/**
 * A window of debug slices, driven exactly as the run loop drives them: no
 * breakpoints and no line resumed from, so nothing ever pauses and each slice
 * is a whole frame's budget.
 */
async function sliceWindow(
  machine: MachineEmulator,
  canvas: HeadlessCanvas,
): Promise<Window> {
  drain(machine);
  const before = paint(machine, canvas);
  let samples = 0;
  for (let i = 0; i < WINDOW; i++) {
    const step = machine.debugStep!({
      breakpoints: new Set(),
      mode: 'run',
      fromLine: null,
    });
    expect(step.paused, 'nothing was breakpointed, so nothing may pause').toBe(
      false,
    );
    samples += machine.readAudio?.().length ?? 0;
    // Yielded on the same cadence as the harness's frame loop, for the same
    // reason: the jsbeeb and Commodore cores settle work on timers.
    if (i % 20 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  const costs = machine.drainProfile?.() ?? [];
  return measured(
    machine,
    canvas,
    costs.reduce((sum, c) => sum + c.cost, 0),
    samples,
    before,
  );
}

describe('a debug slice advances a machine as a frame does', () => {
  let undoRomLoading: () => void;
  let undoCanvas: () => void;
  beforeAll(() => {
    undoRomLoading = installNodeRomLoading();
    // Six machines allocate their back canvas through `document.createElement`.
    undoCanvas = installCanvasGlobals();
  });
  afterAll(() => {
    undoCanvas();
    undoRomLoading();
  });

  for (const dialect of dialects) {
    it(
      `${dialect.id} loses nothing to being stepped`,
      async () => {
        const machine = await bootMachine(dialect);
        try {
          // Whether a machine has a stepper at all is debugCapability.test.ts's
          // fact, checked against the dialect's own flag; one that has none
          // has no second path to diverge from its first.
          if (!steppable(machine)) return;
          expect(
            dialect.id in NO_DEBUG_PARITY,
            `${dialect.id} can be stepped, so it owes a frame per slice`,
          ).toBe(false);

          const { image, errors } = dialect.tokenize(PROBE);
          expect(errors).toEqual([]);
          machine.loadProgram(image);
          // The Commodore and Acorn machines queue their boot-and-inject on a
          // microtask; let it land before running frames at them.
          await new Promise((r) => setTimeout(r, 0));
          await runFrames(machine, SETTLE_FRAMES);
          machine.setProfileRecording?.(true);

          const canvas = new HeadlessCanvas(
            machine.displayWidth,
            machine.displayHeight,
          );
          const frames = await frameWindow(machine, canvas);
          const slices = await sliceWindow(machine, canvas);

          // Time, as the machine's own account of what it ran. The one figure
          // every profiled machine can be compared on, and the one that says
          // outright whether a slice is a frame.
          if (frames.cycles > 0) {
            expect(
              relative(slices.cycles, frames.cycles),
              `${dialect.id} charges ${slices.cycles} cycles over ${WINDOW} ` +
                `debug slices against ${frames.cycles} over ${WINDOW} frames, ` +
                'so a slice is not advancing a frame',
            ).toBeLessThan(TOLERANCE);
          }

          // Sound, where the machine emits a steady stream of it. Gated on the
          // stream rather than on any sample at all, because a beeper is
          // event-driven: the probe knocks one click out of a Sinclair ROM and
          // whichever window happens to contain it has audio the other has
          // none of, which says nothing about either path. A chip that fills
          // buffers off elapsed time says a great deal - it is exactly what the
          // Acorns' missing per-frame flush silenced.
          if (streaming(machine, frames.samples)) {
            expect(
              relative(slices.samples, frames.samples),
              `${dialect.id} synthesizes ${slices.samples} samples over ` +
                `${WINDOW} debug slices against ${frames.samples} over ` +
                `${WINDOW} frames, so a stepped run does not sound like a ` +
                'plain one',
            ).toBeLessThan(AUDIO_TOLERANCE);
          }

          // The picture. The probe prints as it counts, so a machine keeping
          // up repaints across either window - which makes "the slice window
          // did not" a real answer rather than the only one available. It is
          // reachable because the machines that buffer a frame hand back
          // whatever they last painted: a slice path that never painted returns
          // the frame window's picture unchanged, and says so here.
          expect(
            Math.min(frames.colours, slices.colours),
            `${dialect.id} painted a blank frame, so the comparison below ` +
              'would be between two screens with nothing on them',
          ).toBeGreaterThan(1);
          const still = dialect.id in STILL_SCREEN;
          expect(
            frames.repainted,
            still
              ? `${dialect.id} is listed as leaving its screen still, but it ` +
                  'repainted over plain frames - drop it from STILL_SCREEN'
              : `${dialect.id} drew the same picture across ${WINDOW} plain ` +
                  'frames, so there is nothing here for a stepped run to ' +
                  'differ from - give it an entry in STILL_SCREEN saying why',
          ).toBe(!still);
          expect(
            slices.repainted,
            `${dialect.id} repainted over ${WINDOW} frames but not over ` +
              `${WINDOW} debug slices, so a stepped run shows a frozen screen`,
          ).toBe(frames.repainted);

          // And the machine still answers the two questions the run loop asks
          // it every step, which a slice that fell out of its run would not.
          expect(slices.running).toBe(frames.running);
          expect(slices.named).toBe(frames.named);
        } finally {
          machine.dispose();
        }
      },
      BOOT_TIMEOUT_MS,
    );
  }

  it('accounts for every registered dialect either way', () => {
    // Guards the shape of the check itself: an entry left behind by a removed
    // machine, or an emptied registry, would otherwise pass every case above by
    // doing nothing.
    const ids = new Set(dialects.map((d) => d.id));
    for (const id of Object.keys(NO_DEBUG_PARITY)) {
      expect(ids.has(id), `${id} is not a registered dialect`).toBe(true);
    }
    for (const id of Object.keys(STILL_SCREEN)) {
      expect(ids.has(id), `${id} is not a registered dialect`).toBe(true);
    }
    // And the picture comparison reaches most of the registry rather than
    // being excused across it.
    expect(Object.keys(STILL_SCREEN).length).toBeLessThan(dialects.length / 2);
    expect(
      dialects.length - Object.keys(NO_DEBUG_PARITY).length,
    ).toBeGreaterThan(1);
    // And the sweep above really did reach machines, rather than returning at
    // the stepper check for every one of them.
    expect(dialects.some((d) => d.debuggable === true)).toBe(true);
  });
});
