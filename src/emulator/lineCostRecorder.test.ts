import { describe, expect, it } from 'vitest';
import { LineCostRecorder, PROFILE_SLICE_CYCLES } from './lineCostRecorder';

/** Drive a recorder the way a machine's step does, `cycles` at a time. */
function run(
  rec: LineCostRecorder,
  steps: readonly (readonly [cycles: number, line: number | null])[],
): void {
  for (const [cycles, line] of steps) {
    if (!rec.enabled) continue;
    rec.pending += cycles;
    if (rec.pending >= rec.slice) rec.sample(line);
  }
}

/** The drained costs as a plain line → cost map, for readable assertions. */
function costsOf(rec: LineCostRecorder): Record<number, number> | null {
  const drained = rec.drain();
  if (!drained) return null;
  return Object.fromEntries(drained.map((c) => [c.line, c.cost]));
}

describe('LineCostRecorder', () => {
  it('accumulates each line’s cost across many samples', () => {
    const rec = new LineCostRecorder('cycles', PROFILE_SLICE_CYCLES);
    rec.setEnabled(true);
    run(rec, [
      [8, 10],
      [8, 10],
      [8, 20],
      [16, 10],
    ]);
    expect(costsOf(rec)).toEqual({ 10: 32, 20: 8 });
  });

  it('carries the machine’s own unit out with every figure', () => {
    const frames = new LineCostRecorder('frames', 0.05);
    frames.setEnabled(true);
    run(frames, [[0.05, 30]]);
    expect(frames.drain()).toEqual([{ line: 30, cost: 0.05, unit: 'frames' }]);
  });

  it('drains and resets, so a figure describes one run', () => {
    const rec = new LineCostRecorder('cycles', PROFILE_SLICE_CYCLES);
    rec.setEnabled(true);
    run(rec, [[8, 10]]);
    expect(costsOf(rec)).toEqual({ 10: 8 });
    // Nothing carried over into the next drain.
    expect(costsOf(rec)).toEqual({});
    run(rec, [[8, 20]]);
    expect(costsOf(rec)).toEqual({ 20: 8 });
  });

  it('drops time spent outside any BASIC line rather than parking it', () => {
    const rec = new LineCostRecorder('cycles', PROFILE_SLICE_CYCLES);
    rec.setEnabled(true);
    run(rec, [
      [8, 10],
      [8, null], // ROM idle loop / READY prompt
      [8, null],
      [8, 10],
    ]);
    expect(costsOf(rec)).toEqual({ 10: 16 });
  });

  it('holds a part-slice back until the slice fills', () => {
    const rec = new LineCostRecorder('cycles', PROFILE_SLICE_CYCLES);
    rec.setEnabled(true);
    run(rec, [
      [4, 10],
      [3, 10],
    ]);
    // Under the slice: nothing sampled yet, but nothing lost either.
    expect(rec.pending).toBe(7);
    expect(costsOf(rec)).toEqual({});
    run(rec, [[1, 10]]);
    expect(costsOf(rec)).toEqual({ 10: 8 });
  });

  it('records nothing while disabled, and says so with null', () => {
    const rec = new LineCostRecorder('cycles', PROFILE_SLICE_CYCLES);
    run(rec, [
      [8, 10],
      [8, 20],
    ]);
    expect(rec.pending).toBe(0);
    expect(rec.drain()).toBeNull();
  });

  it('empty rather than null once armed with nothing yet measured', () => {
    const rec = new LineCostRecorder('cycles', PROFILE_SLICE_CYCLES);
    rec.setEnabled(true);
    expect(rec.drain()).toEqual([]);
  });

  it('drops what it holds when disarmed, so a later run never inherits it', () => {
    const rec = new LineCostRecorder('cycles', PROFILE_SLICE_CYCLES);
    rec.setEnabled(true);
    run(rec, [[8, 10]]);
    rec.setEnabled(false);
    rec.setEnabled(true);
    expect(costsOf(rec)).toEqual({});
  });
});
