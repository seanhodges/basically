/**
 * Every machine's BASIC speed, measured on the machine rather than authored.
 *
 * The porting guide tells a reader that their delay loops were tuned to the
 * speed of the machine they were written on, and quotes the ratio between the
 * two machines. A hand-written ratio would be a guess about hardware nobody
 * here can measure; this is a measurement of the emulators the reader's ported
 * program will actually run in, which is both honest and checkable.
 *
 * The programs are in {@link ./loopSpeedProbes}, and the figure is the
 * difference between two runs of them: booting, tokenizing, the PRINT and the
 * ROM's own settling all happen in both and cancel, leaving the loop.
 * `PortingFacts.loopSpeed` states the result and this pins it: a machine whose
 * emulator changes speed fails here loudly rather than quietly making the
 * guide's ratios wrong.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { dialects } from './registry';
import {
  bootMachine,
  hasRom,
  installNodeRomLoading,
  screenText,
} from './bootHarness';
import {
  LOOP_END,
  LOOP_SPEED_PROBES,
  LOOP_SPEED_TOLERANCE,
  type LoopSpeedProbe,
} from './loopSpeedProbes';
import { portingFacts } from '../reference/facts';
import type { Dialect } from './types';

/**
 * Machines that cannot be benchmarked here, and why. The same exact-set
 * discipline the operator battery keeps: a machine that stops booting fails
 * rather than silently losing its figure, and a checkout where the user has
 * dropped an image in locally measures it after all.
 */
const NO_ROM: Record<string, string> = {
  altair8800: 'no redistributable ROM ships, so the machine cannot boot here',
};

/** How long the loop is given before the run is called stalled. */
const MAX_FRAMES = 4000;

let restoreRomLoading: () => void;

beforeAll(() => {
  restoreRomLoading = installNodeRomLoading();
});

afterAll(() => {
  restoreRomLoading();
});

function probeFor(dialectId: string): LoopSpeedProbe {
  const probe = LOOP_SPEED_PROBES.find((p) => p.dialects.includes(dialectId));
  if (!probe)
    throw new Error(`No loop-speed probe covers dialect: ${dialectId}`);
  return probe;
}

/** Frames from loading `source` until the machine has printed the marker. */
async function framesToFinish(
  dialect: Dialect,
  source: string,
): Promise<{ frames: number; frameHz: number; screen: string }> {
  const result = dialect.tokenize(source);
  expect(
    result.errors,
    `${dialect.id} could not tokenize its own loop-speed probe program`,
  ).toEqual([]);

  const machine = await bootMachine(dialect);
  try {
    machine.loadProgram(result.image);
    let frames = 0;
    while (frames < MAX_FRAMES && !screenText(machine).includes(LOOP_END)) {
      machine.runFrame();
      frames++;
      // The ROM loads the jsbeeb and Commodore machines start in their
      // constructors settle on timers, which a tight synchronous frame loop
      // never lets land. Same yield the shared bootHarness run loop makes.
      if (frames % 20 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    return { frames, frameHz: machine.frameHz, screen: screenText(machine) };
  } finally {
    machine.dispose();
  }
}

/**
 * Empty-loop iterations a second, as this machine's emulator runs them.
 *
 * Frames rather than wall-clock time: a frame is a fixed slice of emulated time
 * whatever the host is doing, so the figure is a property of the machine and
 * reproducible on a loaded CI runner. `frameHz` turns it into a rate a person
 * can read - and is itself pinned, per machine, by frameRate.test.ts.
 */
async function measure(
  dialect: Dialect,
  probe: LoopSpeedProbe,
): Promise<{ speed: number; frames: number }> {
  const base = await framesToFinish(dialect, probe.base);
  expect(
    base.screen,
    `${dialect.id} never printed ${LOOP_END} without the loop. Screen:\n${base.screen}`,
  ).toContain(LOOP_END);
  const loop = await framesToFinish(dialect, probe.loop);
  expect(
    loop.screen,
    `${dialect.id} never printed ${LOOP_END} after the loop. Screen:\n${loop.screen}`,
  ).toContain(LOOP_END);
  // At least one frame: a machine that ran the loop inside the frame the bare
  // program finished in has run it faster than this can resolve, and dividing
  // by zero would report an infinite speed rather than a fast one.
  const frames = Math.max(1, loop.frames - base.frames);
  return { speed: (probe.iterations * loop.frameHz) / frames, frames };
}

describe('BASIC speed, as the emulator runs it', () => {
  for (const dialect of dialects) {
    const probe = probeFor(dialect.id);
    const reason = NO_ROM[dialect.id];
    const facts = portingFacts.find((f) => f.id === dialect.id);

    if (reason && !hasRom(dialect)) {
      it(`${dialect.id} cannot be benchmarked here: ${reason}`, () => {
        expect(
          facts?.loopSpeed,
          `${dialect.id} cannot be measured, so it must claim no speed`,
        ).toBeUndefined();
      });
      continue;
    }

    it(`${dialect.id} runs its loop at the speed the facts state`, async () => {
      const { speed, frames } = await measure(dialect, probe);
      const authored = facts?.loopSpeed;
      expect(
        authored,
        `${dialect.id} measures ${speed.toFixed(0)} iterations/second (${frames} frames) and states no loopSpeed`,
      ).toBeDefined();
      const drift = Math.abs(speed - authored!) / authored!;
      expect(
        drift,
        `${dialect.id} measures ${speed.toFixed(0)} iterations/second over ${frames} frames, but its facts state ${authored}`,
      ).toBeLessThanOrEqual(LOOP_SPEED_TOLERANCE);
    }, 120000);
  }
});

describe('the loop-speed probe table covers the registry', () => {
  it('claims every registered dialect exactly once', () => {
    const claimed = LOOP_SPEED_PROBES.flatMap((p) => p.dialects);
    expect([...claimed].sort()).toEqual(dialects.map((d) => d.id).sort());
  });
});
