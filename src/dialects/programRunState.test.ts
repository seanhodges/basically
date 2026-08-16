/**
 * Every registered machine reports whether a BASIC program is executing, and
 * reaches a definite answer.
 *
 * The seam member is required, but a type cannot require an *answer*:
 * `isProgramRunning() { return null }` compiles and leaves the stopwatch running
 * for ever, the assistant told nothing finished and the run control still
 * offering to pause a program that has ended. So the obligation is checked
 * against the machines, over the registry, on their real ROMs - a dialect added
 * later cannot quietly reintroduce the gap, and the five per-machine traces that
 * each sampled the same three facts are gone in favour of this one.
 *
 * Two programs are enough to state the whole contract:
 *
 *  - a counting loop, which starts, runs measurably, then falls off its end;
 *  - `10 GOTO 10`, which never ends.
 *
 * The counting loop's iteration count comes from {@link LOOP_SPEED_PROBES},
 * which already answers "how many iterations is a visible stretch of time on
 * this machine" per language family - these machines are two orders of
 * magnitude apart in BASIC speed, and a single count would either finish inside
 * one frame on a CPC or run for emulated minutes on a ZX81.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { dialects } from './registry';
import {
  bootMachine,
  hasRom,
  installNodeRomLoading,
  romFor,
} from './bootHarness';
import { LOOP_SPEED_PROBES } from './loopSpeedProbes';
import type { Dialect, MachineEmulator } from './types';

/** Booting the real ROMs dominates every case here (see c64Machine.test.ts). */
const BOOT_TIMEOUT_MS = 120_000;

/**
 * Machines that cannot be booted here, and why - the same exact-set discipline
 * loopSpeed.test.ts keeps: a machine that stops booting fails rather than
 * silently losing its coverage, and a checkout where the user has dropped an
 * image in locally is held to the contract after all.
 */
const NO_ROM: Record<string, string> = {
  altair8800: 'no redistributable ROM ships, so the machine cannot boot here',
};

/** Frames a terminating program is given to start, run and end. */
const MAX_FRAMES = 4000;
/** Frames a program that never ends goes on being watched for, once started. */
const WATCH_FRAMES = 200;
/** Frames a stopped program is watched for after the first `false`. */
const SETTLED_FRAMES = 30;

/** Iterations that take this machine a visible stretch of time. */
function iterationsFor(dialectId: string): number {
  const probe = LOOP_SPEED_PROBES.find((p) => p.dialects.includes(dialectId));
  if (!probe)
    throw new Error(`no loop-speed probe covers dialect: ${dialectId}`);
  return probe.iterations;
}

function tokenized(dialect: Dialect, source: string): Uint8Array {
  const { image, errors } = dialect.tokenize(source);
  expect(errors, `${dialect.id} could not tokenize its own probe`).toEqual([]);
  return image;
}

/**
 * Hand the machine a program and sample what it says about itself once per
 * frame, from the hand-over rather than from the settled state - the interval
 * between being given a program and starting it is the one a machine most
 * easily gets wrong.
 */
async function sampleRun(
  machine: MachineEmulator,
  image: Uint8Array,
  stopAt: (running: boolean | null) => boolean,
  maxFrames: number,
): Promise<(boolean | null)[]> {
  machine.loadProgram(image);
  // The Acorn, Atom and Commodore machines queue their boot-and-inject on a
  // microtask; let it land before the first sample.
  await new Promise((r) => setTimeout(r, 0));
  const seen: (boolean | null)[] = [];
  for (let frame = 0; frame < maxFrames; frame++) {
    machine.runFrame();
    const running = machine.isProgramRunning();
    seen.push(running);
    if (stopAt(running)) break;
    // Same yield the shared bootHarness run loop makes: the ROM loads several
    // machines start in their constructors settle on timers.
    if (frame % 20 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  return seen;
}

describe('every registered machine reports whether a program is running', () => {
  let restoreRomLoading: () => void;
  beforeAll(() => {
    restoreRomLoading = installNodeRomLoading();
  });
  afterAll(() => restoreRomLoading());

  for (const dialect of dialects) {
    const reason = NO_ROM[dialect.id];
    if (reason && !hasRom(dialect)) {
      it(`${dialect.id} cannot be run here: ${reason}`, () => {
        // Still held to the seam: the member is required of every machine, and
        // this one's absence of a ROM says nothing about whether it has it.
        const machine = dialect.createEmulator({
          rom: romFor(dialect.romUrl),
          ramKb: 16,
        });
        expect(typeof machine.isProgramRunning).toBe('function');
        machine.dispose();
      });
      continue;
    }

    it(
      `${dialect.id} reports a program running and then stopped`,
      async () => {
        const machine = await bootMachine(dialect);
        try {
          const source = `10 FOR I=1 TO ${iterationsFor(dialect.id)}\n20 NEXT I\n`;
          const seen = await sampleRun(
            machine,
            tokenized(dialect, source),
            (running) => running === false,
            MAX_FRAMES,
          );
          const started = seen.indexOf(true);
          const ended = seen.indexOf(false);
          expect(
            started,
            `${dialect.id} never reported the program running`,
          ).toBeGreaterThanOrEqual(0);
          expect(
            ended,
            `${dialect.id} never reported the program stopping`,
          ).toBeGreaterThanOrEqual(0);
          // Everything before the first `true` must be "not answerable yet": a
          // `false` there would report a program that has not begun as ended,
          // which is what the seconds spent handing a machine its program would
          // otherwise look like.
          expect(
            ended,
            `${dialect.id} reported no program running before it had started one`,
          ).toBeGreaterThan(started);
          // ...and the answer holds. The machine goes on running at its prompt,
          // but the program does not come back.
          for (let i = 0; i < SETTLED_FRAMES; i++) machine.runFrame();
          expect(
            machine.isProgramRunning(),
            `${dialect.id} stopped reporting the program stopped`,
          ).toBe(false);
        } finally {
          machine.dispose();
        }
      },
      BOOT_TIMEOUT_MS,
    );

    it(
      `${dialect.id} goes on reporting a program that never ends`,
      async () => {
        const machine = await bootMachine(dialect);
        try {
          const seen = await sampleRun(
            machine,
            tokenized(dialect, '10 GOTO 10\n'),
            (running) => running === true,
            MAX_FRAMES,
          );
          expect(
            seen.at(-1),
            `${dialect.id} never reported the looping program running`,
          ).toBe(true);
          expect(
            seen,
            `${dialect.id} reported no program running before it had started one`,
          ).not.toContain(false);
          for (let i = 0; i < WATCH_FRAMES; i++) machine.runFrame();
          expect(
            machine.isProgramRunning(),
            `${dialect.id} reported a program that is still looping as finished`,
          ).toBe(true);
        } finally {
          machine.dispose();
        }
      },
      BOOT_TIMEOUT_MS,
    );
  }
});
