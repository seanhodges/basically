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
 * What it cannot see: a counter that reaches only the painted picture. The
 * PMD 85's blink attribute is driven off its frame count and read at
 * `renderTo`, which needs a canvas that the node environment does not have -
 * several machines paint through `document.createElement`. That half is pinned
 * against the one machine that has it, in `pmd85/emulator/pmd85Machine.test.ts`.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { dialects } from './registry';
import { bootMachine, installNodeRomLoading, runFrames } from './bootHarness';
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
}

/** Drain everything the machine accumulated, so a window starts from nothing. */
function drain(machine: MachineEmulator): void {
  machine.drainProfile?.();
  machine.readAudio?.();
}

function measured(machine: MachineEmulator, cycles: number, samples: number) {
  return {
    cycles,
    samples,
    running: machine.isProgramRunning(),
    named: machine.currentLine?.() !== null,
  };
}

/** A window of ordinary frames. */
async function frameWindow(machine: MachineEmulator): Promise<Window> {
  drain(machine);
  let samples = 0;
  for (let i = 0; i < WINDOW; i++) {
    await runFrames(machine, 1);
    samples += machine.readAudio?.().length ?? 0;
  }
  const costs = machine.drainProfile?.() ?? [];
  return measured(
    machine,
    costs.reduce((sum, c) => sum + c.cost, 0),
    samples,
  );
}

/**
 * A window of debug slices, driven exactly as the run loop drives them: no
 * breakpoints and no line resumed from, so nothing ever pauses and each slice
 * is a whole frame's budget.
 */
async function sliceWindow(machine: MachineEmulator): Promise<Window> {
  drain(machine);
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
    costs.reduce((sum, c) => sum + c.cost, 0),
    samples,
  );
}

describe('a debug slice advances a machine as a frame does', () => {
  let undoRomLoading: () => void;
  beforeAll(() => {
    undoRomLoading = installNodeRomLoading();
  });
  afterAll(() => undoRomLoading());

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

          const frames = await frameWindow(machine);
          const slices = await sliceWindow(machine);

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
    expect(
      dialects.length - Object.keys(NO_DEBUG_PARITY).length,
    ).toBeGreaterThan(1);
    // And the sweep above really did reach machines, rather than returning at
    // the stepper check for every one of them.
    expect(dialects.some((d) => d.debuggable === true)).toBe(true);
  });
});
