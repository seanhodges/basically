import { describe, expect, it } from 'vitest';
import type { LineCost, MachineMemoryStats } from '../dialects/types';
import {
  MAX_MEMORY_SAMPLES,
  MEMORY_SAMPLE_FRAMES,
  RunProfiler,
  lineShares,
  profileStillApplies,
  programLineNumbers,
  routineShares,
} from './runProfile';
import { outlineCapabilities } from '../editor/programOutline';

const CYCLES = (line: number, cost: number): LineCost => ({
  line,
  cost,
  unit: 'cycles',
});
const FRAMES = (line: number, cost: number): LineCost => ({
  line,
  cost,
  unit: 'frames',
});

/** A machine reporting a steady 1000/9000 split. */
const steady = (): MachineMemoryStats => ({ used: 1000, free: 9000 });

/** Run `frames` frames at 50Hz, charging `costs` on each. */
function run(
  profiler: RunProfiler,
  frames: number,
  costs: LineCost[] | null,
  memory: () => MachineMemoryStats | null = steady,
): void {
  for (let i = 0; i < frames; i++) profiler.frame(costs, memory, 50);
}

describe('lineShares', () => {
  it('reads the same whether the machine counted cycles or frames', () => {
    const inCycles = lineShares([CYCLES(20, 750), CYCLES(30, 250)]);
    const inFrames = lineShares([FRAMES(20, 0.75), FRAMES(30, 0.25)]);
    expect(inCycles.map((s) => [s.line, s.share])).toEqual([
      [20, 0.75],
      [30, 0.25],
    ]);
    expect(inFrames.map((s) => [s.line, s.share])).toEqual(
      inCycles.map((s) => [s.line, s.share]),
    );
    expect(inCycles[0]!.unit).toBe('cycles');
    expect(inFrames[0]!.unit).toBe('frames');
  });

  it('orders by share, so the line dominating a run comes first', () => {
    const shares = lineShares([CYCLES(10, 1), CYCLES(20, 98), CYCLES(30, 1)]);
    expect(shares[0]!.line).toBe(20);
    expect(shares[0]!.share).toBeCloseTo(0.98);
  });

  it('leaves a line that consumed nothing out rather than reporting zero', () => {
    expect(
      lineShares([CYCLES(10, 0), CYCLES(20, 5)]).map((s) => s.line),
    ).toEqual([20]);
  });

  it('reports nothing when nothing was measured', () => {
    expect(lineShares([])).toEqual([]);
    expect(lineShares([CYCLES(10, 0)])).toEqual([]);
  });
});

describe('routineShares', () => {
  const SOURCE = [
    '10 GOSUB 100',
    '20 GOSUB 200',
    '30 GOTO 10',
    '100 REM DRAW',
    '110 RETURN',
    '200 REM MOVE',
    '210 RETURN',
  ].join('\n');
  const caps = outlineCapabilities([
    { word: 'GOSUB' },
    { word: 'GOTO' },
  ] as never);

  it('sums a routine’s lines so its total is readable without adding up', () => {
    const shares = lineShares([
      CYCLES(10, 5),
      CYCLES(100, 40),
      CYCLES(110, 5),
      CYCLES(200, 45),
      CYCLES(210, 5),
    ]);
    const routines = routineShares(SOURCE, caps, shares);
    const byLine = new Map(routines.map((r) => [r.lineNo, r.share]));
    expect(byLine.get(100)).toBeCloseTo(0.45);
    expect(byLine.get(200)).toBeCloseTo(0.5);
    // Hottest first, so the routine to look at is the one at the top.
    expect(routines[0]!.lineNo).toBe(200);
  });

  it('reports nothing for a program with no routines to roll up', () => {
    expect(routineShares('10 PRINT 1\n20 PRINT 2\n', caps, [])).toEqual([]);
  });
});

describe('RunProfiler', () => {
  it('accumulates per-line costs across the frames of a run', () => {
    const p = new RunProfiler(null, [10, 20]);
    run(p, 3, [CYCLES(20, 100)]);
    expect(p.snapshot().lines).toEqual([
      { line: 20, cost: 300, unit: 'cycles' },
    ]);
  });

  it('reports the run in the machine’s own time, not the browser’s', () => {
    const p = new RunProfiler(null, []);
    run(p, 100, []);
    expect(p.snapshot().elapsed).toBeCloseTo(2); // 100 frames at 50Hz
  });

  it('positions the memory account against the run’s elapsed time', () => {
    const p = new RunProfiler(null, []);
    run(p, MEMORY_SAMPLE_FRAMES * 3 + 1, []);
    const memory = p.snapshot().memory!;
    // Sampled on the first frame - the run's own baseline - and every cadence
    // after it.
    expect(memory.samples.length).toBe(4);
    expect(memory.samples[0]!.at).toBeCloseTo(1 / 50);
    expect(memory.samples[3]!.at).toBeCloseTo(
      (MEMORY_SAMPLE_FRAMES * 3 + 1) / 50,
    );
    expect(memory.totalBytes).toBe(10_000);
    expect(memory.partial).toBe(false);
  });

  it('shows memory rising, and falling again when BASIC reclaims it', () => {
    const p = new RunProfiler(null, []);
    let used = 1000;
    const growThenReclaim = (): MachineMemoryStats => {
      used = used >= 4000 ? 1200 : used + 1000;
      return { used, free: 10_000 - used };
    };
    run(p, MEMORY_SAMPLE_FRAMES * 5, [], growThenReclaim);
    const memory = p.snapshot().memory!;
    expect(memory.samples.map((s) => s.used)).toEqual([
      2000, 3000, 4000, 1200, 2200,
    ]);
    expect(memory.peakUsed).toBe(4000);
  });

  it('bounds the series on a long run, keeping the peak and saying it is partial', () => {
    const p = new RunProfiler(null, []);
    // A spike early enough that the retained tail can no longer cover it.
    let sample = 0;
    const spikeThenSettle = (): MachineMemoryStats => {
      sample++;
      const used = sample === 1 ? 9000 : 1000;
      return { used, free: 10_000 - used };
    };
    run(
      p,
      MEMORY_SAMPLE_FRAMES * (MAX_MEMORY_SAMPLES + 10),
      [],
      spikeThenSettle,
    );
    const memory = p.snapshot().memory!;
    expect(memory.samples.length).toBe(MAX_MEMORY_SAMPLES);
    expect(memory.samples.some((s) => s.used === 9000)).toBe(false);
    expect(memory.peakUsed).toBe(9000);
    expect(memory.partial).toBe(true);
  });

  it('offers per-line costs without a memory account, and the other way round', () => {
    const noMemory = new RunProfiler(null, []);
    run(noMemory, MEMORY_SAMPLE_FRAMES * 2, [CYCLES(20, 10)], () => null);
    expect(noMemory.snapshot().memory).toBeNull();
    expect(noMemory.snapshot().lines).not.toBeNull();

    const noLines = new RunProfiler(null, []);
    run(noLines, MEMORY_SAMPLE_FRAMES * 2, null);
    expect(noLines.snapshot().lines).toBeNull();
    expect(noLines.snapshot().memory).not.toBeNull();
  });

  it('says nothing has been measured before anything has', () => {
    const p = new RunProfiler(null, []);
    expect(p.measured).toBe(false);
    // Armed on a machine that answers neither question: still nothing measured.
    run(p, 5, null, () => null);
    expect(p.measured).toBe(false);
    run(p, 1, [CYCLES(20, 4)], () => null);
    expect(p.measured).toBe(true);
  });
});

describe('profileStillApplies', () => {
  const measured = (source: string) => ({
    bufferId: null,
    measuredLines: programLineNumbers(source),
    lines: null,
    memory: null,
    elapsed: 0,
  });

  it('holds while the same lines are there', () => {
    const profile = measured('10 PRINT 1\n20 GOTO 10\n');
    expect(profileStillApplies(profile, '10 PRINT 2\n20 GOTO 10\n')).toBe(true);
  });

  it('does not survive an edit that adds, removes or renumbers a line', () => {
    const profile = measured('10 PRINT 1\n20 GOTO 10\n');
    expect(
      profileStillApplies(profile, '10 PRINT 1\n15 PRINT 2\n20 GOTO 10\n'),
    ).toBe(false);
    expect(profileStillApplies(profile, '10 PRINT 1\n')).toBe(false);
    expect(profileStillApplies(profile, '100 PRINT 1\n200 GOTO 100\n')).toBe(
      false,
    );
  });
});
