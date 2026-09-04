import { describe, expect, it } from 'vitest';
import type { LineCost, MachineMemoryStats } from '../dialects/types';
import { RunMeasurements, type MeasuredMachine } from './runMeasurements';
import {
  PROFILE_PUBLISH_FRAMES,
  RunProfiler,
  programLineNumbers,
} from './runProfile';
import { RunStopwatch, timingFrame } from './runTiming';

/**
 * The fold produces what the emulator pane produced for the same frames: the
 * pane used to hold a profiler and a stopwatch of its own and fold each frame
 * into both by hand, so the same sequence driven through both paths must land
 * on the same profile and the same timing.
 */

const SOURCE = '10 LET A=1\n20 PRINT A\n30 GOTO 10\n';

/** A scripted machine: what it charges, reports and says about running per frame. */
function scripted(
  frames: {
    costs?: LineCost[];
    memory?: MachineMemoryStats;
    running: boolean | null;
  }[],
): MeasuredMachine & { recording: boolean[]; at: number } {
  const machine = {
    recording: [] as boolean[],
    at: -1,
    frameHz: 50,
    drainProfile: () => frames[machine.at]?.costs ?? null,
    readMemoryStats: () => frames[machine.at]?.memory ?? null,
    setProfileRecording: (on: boolean) => {
      machine.recording.push(on);
    },
    isProgramRunning: () => frames[machine.at]?.running ?? null,
    readReport: () => ({ code: 0, message: '0 OK', ok: true, line: 0 }),
  };
  return machine as typeof machine & MeasuredMachine;
}

describe('folding a run frame by frame', () => {
  const script = [
    { running: null },
    ...Array.from({ length: 60 }, (_, i) => ({
      costs: [{ line: 10 + 10 * (i % 3), cost: 100 }],
      memory: { used: 1000 + i, free: 15_000 - i },
      running: true as const,
    })),
    { running: false as const },
    { running: false as const },
  ];

  it('produces the profile and timing the pane produced by hand', () => {
    const machine = scripted(script);
    const measurements = new RunMeasurements('buf', SOURCE);
    const profiler = new RunProfiler('buf', programLineNumbers(SOURCE));
    const stopwatch = new RunStopwatch('buf');
    const byHand = scripted(script);

    const steps: string[] = [];
    for (let i = 0; i < script.length; i++) {
      machine.at = i;
      byHand.at = i;
      steps.push(measurements.frame(machine));
      // The pane's own fold, as it was written.
      profiler.frame(
        byHand.drainProfile?.() ?? null,
        () => byHand.readMemoryStats?.() ?? null,
        byHand.frameHz,
      );
      stopwatch.frame(profiler.elapsedSeconds, timingFrame(byHand));
      if (stopwatch.settled) break;
    }

    expect(measurements.profile()).toEqual(profiler.snapshot());
    expect(measurements.timing()).toEqual(stopwatch.timing());
    expect(measurements.timing().ending).toBe('finished');
  });

  it('asks for a publish on the profiler cadence and settles when the program ends', () => {
    const machine = scripted(script);
    const measurements = new RunMeasurements('buf', SOURCE);
    const steps: string[] = [];
    for (let i = 0; i < script.length; i++) {
      machine.at = i;
      steps.push(measurements.frame(machine));
    }
    const publishes = steps
      .map((s, i) => (s === 'publish' ? i + 1 : null))
      .filter((i): i is number => i !== null);
    // Every publish falls on the cadence, and the cadence is kept.
    expect(publishes.length).toBeGreaterThan(0);
    for (const at of publishes) expect(at % PROFILE_PUBLISH_FRAMES).toBe(0);
    // Settled once, on the frame the program was seen to stop; quiet after.
    expect(steps.filter((s) => s === 'settled')).toHaveLength(1);
    expect(steps.indexOf('settled')).toBe(61);
    expect(steps.slice(62).every((s) => s === 'quiet')).toBe(true);
    // Recording is switched off at the machine when the fold settles.
    expect(machine.recording).toEqual([false]);
    expect(measurements.settled).toBe(true);
  });

  it('arms the machine, discarding what the boot charged', () => {
    const machine = scripted([
      { costs: [{ line: 5, cost: 999 }], running: null },
    ]);
    machine.at = 0;
    const measurements = new RunMeasurements(null, SOURCE);
    measurements.arm(machine);
    expect(machine.recording).toEqual([true]);
    expect(measurements.profile()).toBeNull();
  });

  it('ends a stopped run as stopped, never as a completion', () => {
    const machine = scripted(script.slice(0, 30));
    const measurements = new RunMeasurements(null, SOURCE);
    for (let i = 0; i < 30; i++) {
      machine.at = i;
      measurements.frame(machine);
    }
    measurements.stop();
    expect(measurements.timing().ending).toBe('stopped');
    expect(measurements.frame(machine)).toBe('quiet');
  });
});
