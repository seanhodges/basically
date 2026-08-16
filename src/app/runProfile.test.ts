import { describe, expect, it } from 'vitest';
import type { LineCost, MachineMemoryStats } from '../dialects/types';
import {
  MAX_MEMORY_SAMPLES,
  MEMORY_SAMPLE_FRAMES,
  HEAT_LEVELS,
  RunProfiler,
  type LineAllocation,
  lineHeat,
  lineShares,
  lineAllocations,
  profileStillApplies,
  programLineNumbers,
  routineAllocations,
  routineShares,
  totalAllocated,
} from './runProfile';
import { outlineCapabilities } from '../editor/programOutline';

const CYCLES = (line: number, cost: number): LineCost => ({ line, cost });
const BYTES = (line: number, bytes: number): LineAllocation => ({
  line,
  bytes,
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
  it('reads a run as proportions, whatever the machine is clocked at', () => {
    // The same shares whether the cycles were counted at 1MHz or at 4: a share
    // is what "where did the time go" asks, and it needs no clock rate.
    const slow = lineShares([CYCLES(20, 750), CYCLES(30, 250)]);
    const fast = lineShares([CYCLES(20, 3_000_000), CYCLES(30, 1_000_000)]);
    expect(slow.map((s) => [s.line, s.share])).toEqual([
      [20, 0.75],
      [30, 0.25],
    ]);
    expect(fast.map((s) => [s.line, s.share])).toEqual(
      slow.map((s) => [s.line, s.share]),
    );
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

  it('covers the same lines for memory as for time', () => {
    // One outline, one set of extents. Two lists that disagreed about which
    // lines a routine owns would leave a user reading them side by side with no
    // way to tell which was right.
    const time = routineShares(SOURCE, caps, lineShares([CYCLES(110, 100)]));
    const memory = routineAllocations(SOURCE, caps, [BYTES(110, 100)]);
    // Line 110 belongs to the routine that starts at 100, in both readings, and
    // that routine covers the same lines in both.
    expect(memory[0]!.lineNo).toBe(100);
    const spans = (r: { lineNo: number; through: number }) => [
      r.lineNo,
      r.through,
    ];
    expect(spans(memory[0]!)).toEqual(
      spans(time.find((r) => r.lineNo === 100)!),
    );
  });
});

describe('lineAllocations', () => {
  it('ranks the lines that took the memory, greediest first', () => {
    const ranked = lineAllocations([
      BYTES(20, 100),
      BYTES(40, 900),
      BYTES(30, 0),
    ]);
    expect(ranked.map((a) => a.line)).toEqual([40, 20]);
    expect(ranked.map((a) => a.bytes)).toEqual([900, 100]);
    expect(ranked[0]!.share).toBeCloseTo(0.9);
  });

  it('reports bytes, not a share of a machine’s memory', () => {
    // The same figures whether the machine fitted 16K or 64K: how much memory a
    // line took is asked and answered in bytes, and needs no total to mean
    // something. The share exists only to size a bar against the greediest
    // line.
    expect(lineAllocations([BYTES(20, 4096)])[0]!.bytes).toBe(4096);
    expect(totalAllocated([BYTES(20, 100), BYTES(30, 50)])).toBe(150);
  });

  it('leaves out the lines that took nothing rather than listing zeroes', () => {
    // Same reading the gutter gives time: a line that took no memory is not a
    // line that took a little, and listing it would bury the ones that did.
    expect(lineAllocations([BYTES(20, 0), BYTES(30, 0)])).toEqual([]);
  });
});

describe('routineAllocations', () => {
  const SOURCE = [
    '10 GOSUB 100',
    '20 GOTO 10',
    '100 REM BUILD',
    '110 RETURN',
  ].join('\n');
  const caps = outlineCapabilities([
    { word: 'GOSUB' },
    { word: 'GOTO' },
  ] as never);

  it('charges a subroutine’s memory to the subroutine, not to its caller', () => {
    const routines = routineAllocations(SOURCE, caps, [
      BYTES(10, 0),
      BYTES(100, 900),
    ]);
    const byLine = new Map(routines.map((r) => [r.lineNo, r.bytes]));
    // Line 10 is the call site and takes nothing, however much line 100 takes -
    // and is left out rather than padding the ranking with a zero, as the time
    // roll-up would list it.
    expect(byLine.has(10)).toBe(false);
    expect(routineShares(SOURCE, caps, []).some((r) => r.lineNo === 10)).toBe(
      true,
    );
    expect(byLine.get(100)).toBe(900);
    expect(routines[0]!.lineNo).toBe(100);
  });

  it('reports nothing when no line took anything', () => {
    expect(routineAllocations(SOURCE, caps, [BYTES(10, 0)])).toEqual([]);
  });
});

describe('lineHeat', () => {
  it('marks the line that dominates the run apart from incidental ones', () => {
    const heat = lineHeat(
      lineShares([CYCLES(10, 900), CYCLES(20, 90), CYCLES(30, 10)]),
    );
    expect(heat.get(10)!.level).toBe(HEAT_LEVELS);
    expect(heat.get(20)!.level).toBeLessThan(HEAT_LEVELS);
    expect(heat.get(30)!.level).toBe(1);
  });

  it('leaves a line that never ran unmarked, not marked as cheap', () => {
    const heat = lineHeat(lineShares([CYCLES(10, 100), CYCLES(20, 0)]));
    expect(heat.has(20)).toBe(false);
    // ...where a line that ran cheaply is marked, at the coolest band.
    const cheap = lineHeat(lineShares([CYCLES(10, 1000), CYCLES(20, 1)]));
    expect(cheap.get(20)!.level).toBe(1);
  });

  it('spans the bands even when no single line took much of the run', () => {
    // Fifty lines sharing the work: on an absolute scale none would reach 5%
    // and every one would draw the same, saying nothing about which is hottest.
    const spread = Array.from({ length: 50 }, (_, i) => CYCLES(10 + i, i + 1));
    const heat = lineHeat(lineShares(spread));
    expect(heat.get(59)!.level).toBe(HEAT_LEVELS);
    expect(heat.get(10)!.level).toBe(1);
  });

  it('marks nothing when nothing was measured', () => {
    expect(lineHeat([]).size).toBe(0);
  });
});

describe('RunProfiler', () => {
  it('accumulates per-line costs across the frames of a run', () => {
    const p = new RunProfiler(null, [10, 20]);
    run(p, 3, [CYCLES(20, 100)]);
    expect(p.snapshot().lines).toEqual([{ line: 20, cost: 300 }]);
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

  it('accumulates the bytes the machine charged to each line', () => {
    const p = new RunProfiler(null, [10, 20]);
    run(p, 3, [
      { line: 20, cost: 100, allocated: 40 },
      { line: 30, cost: 10, allocated: 0 },
    ]);
    // Line 30 took nothing on any frame and is left out; carrying it as a zero
    // would put it in a list of the lines that took memory.
    expect(p.snapshot().allocations).toEqual({
      lines: [{ line: 20, bytes: 120 }],
      accuracy: 'measured',
    });
  });

  it('offers an empty breakdown when nothing the machine can see was taken', () => {
    const p = new RunProfiler(null, []);
    run(p, 3, [{ line: 20, cost: 100, allocated: 0 }]);
    // Empty, not null: readings were taken, and no line took memory the
    // machine's own figure could see - the ordinary state on a machine whose
    // figure spans a range a program's string churn happens outside of.
    expect(p.snapshot().allocations).toEqual({
      lines: [],
      accuracy: 'measured',
    });
  });

  it('says no reading was taken at all apart from none being taken', () => {
    const p = new RunProfiler(null, []);
    run(p, 3, [CYCLES(20, 100)], () => null);
    // Null: nothing was ever read, so nothing is known either way. A different
    // answer from the empty account above, and the per-line costs stand.
    expect(p.snapshot().allocations).toBeNull();
    expect(p.snapshot().lines).not.toBeNull();
  });

  it('spreads a rise over the window’s lines when no line could be priced', () => {
    const p = new RunProfiler(null, []);
    let used = 1000;
    // Two lines running, three quarters of the cycles on line 20. The machine
    // charges no bytes at all - it never left a line to price one.
    run(p, MEMORY_SAMPLE_FRAMES * 3, [CYCLES(20, 30), CYCLES(30, 10)], () => {
      used += 400;
      return { used, free: 10_000 - used };
    });
    const account = p.snapshot().allocations!;
    expect(account.accuracy).toBe('approximate');
    const byLine = new Map(account.lines.map((a) => [a.line, a.bytes]));
    // Three samples: the first is the baseline and charges nobody, and the two
    // after it rose 400 bytes each, split three-to-one by the cycles.
    expect(byLine.get(20)).toBe(600);
    expect(byLine.get(30)).toBe(200);
  });

  it('prefers what the machine measured over what can be spread', () => {
    const p = new RunProfiler(null, []);
    let used = 1000;
    run(
      p,
      MEMORY_SAMPLE_FRAMES * 2,
      [
        { line: 20, cost: 30, allocated: 0 },
        { line: 30, cost: 10, allocated: 5 },
      ],
      () => {
        used += 400;
        return { used, free: 10_000 - used };
      },
    );
    const account = p.snapshot().allocations!;
    // The machine priced line 30, so the spread is not offered at all - not
    // even for line 20, which it priced at nothing. Mixing the two would credit
    // a line that took nothing for the cycles it happened to burn.
    expect(account.accuracy).toBe('measured');
    expect(account.lines.map((a) => a.line)).toEqual([30]);
  });

  it('spreads nothing across a gap in the machine’s figures', () => {
    const p = new RunProfiler(null, []);
    let reading = 0;
    // A figure, then none for a window, then a figure 5,000 bytes higher. The
    // gap cannot be priced: charging it would land a boot or an injection on
    // whichever lines happened to run next.
    run(p, MEMORY_SAMPLE_FRAMES * 3, [CYCLES(20, 10)], () => {
      reading++;
      if (reading === 2) return null;
      return { used: reading === 1 ? 1000 : 6000, free: 1000 };
    });
    expect(p.snapshot().allocations).toEqual({
      lines: [],
      accuracy: 'measured',
    });
  });

  it('spreads nothing over a window in which no line of the program ran', () => {
    const p = new RunProfiler(null, []);
    let used = 1000;
    // A machine that cannot report its executing line: memory moved, but to no
    // line this program can be shown against.
    run(p, MEMORY_SAMPLE_FRAMES * 2, null, () => {
      used += 400;
      return { used, free: 10_000 - used };
    });
    expect(p.snapshot().allocations).toEqual({
      lines: [],
      accuracy: 'measured',
    });
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
    allocations: null,
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
