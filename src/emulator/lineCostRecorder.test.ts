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

/**
 * A reader over a scripted sequence of in-use figures, one taken per line
 * change, so a test can say what the machine's memory did rather than fake a
 * machine to do it.
 */
function readings(...used: readonly (number | null)[]): () => number | null {
  let i = 0;
  return () => used[Math.min(i++, used.length - 1)] ?? null;
}

/** The drained bytes as a plain line → bytes map; null where none are offered. */
function bytesOf(rec: LineCostRecorder): Record<number, number> | null {
  const drained = rec.drain();
  if (!drained) return null;
  if (drained.some((c) => c.allocated === undefined)) return null;
  return Object.fromEntries(drained.map((c) => [c.line, c.allocated!]));
}

describe('LineCostRecorder', () => {
  it('accumulates each line’s cost across many samples', () => {
    const rec = new LineCostRecorder(PROFILE_SLICE_CYCLES);
    rec.setEnabled(true);
    run(rec, [
      [8, 10],
      [8, 10],
      [8, 20],
      [16, 10],
    ]);
    expect(costsOf(rec)).toEqual({ 10: 32, 20: 8 });
  });

  it('drains and resets, so a figure describes one run', () => {
    const rec = new LineCostRecorder(PROFILE_SLICE_CYCLES);
    rec.setEnabled(true);
    run(rec, [[8, 10]]);
    expect(costsOf(rec)).toEqual({ 10: 8 });
    // Nothing carried over into the next drain.
    expect(costsOf(rec)).toEqual({});
    run(rec, [[8, 20]]);
    expect(costsOf(rec)).toEqual({ 20: 8 });
  });

  it('drops time spent outside any BASIC line rather than parking it', () => {
    const rec = new LineCostRecorder(PROFILE_SLICE_CYCLES);
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
    const rec = new LineCostRecorder(PROFILE_SLICE_CYCLES);
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
    const rec = new LineCostRecorder(PROFILE_SLICE_CYCLES);
    run(rec, [
      [8, 10],
      [8, 20],
    ]);
    expect(rec.pending).toBe(0);
    expect(rec.drain()).toBeNull();
  });

  it('empty rather than null once armed with nothing yet measured', () => {
    const rec = new LineCostRecorder(PROFILE_SLICE_CYCLES);
    rec.setEnabled(true);
    expect(rec.drain()).toEqual([]);
  });

  it('drops what it holds when disarmed, so a later run never inherits it', () => {
    const rec = new LineCostRecorder(PROFILE_SLICE_CYCLES);
    rec.setEnabled(true);
    run(rec, [[8, 10]]);
    rec.setEnabled(false);
    rec.setEnabled(true);
    expect(costsOf(rec)).toEqual({});
  });
});

describe('LineCostRecorder charging memory', () => {
  it('charges what memory rose by to the line that had been executing', () => {
    const rec = new LineCostRecorder(
      PROFILE_SLICE_CYCLES,
      readings(1000, 1100, 1100),
    );
    rec.setEnabled(true);
    run(rec, [
      [8, 10],
      [8, 10],
      [8, 20],
      [8, 20],
      [8, 30],
    ]);
    // The first reading is a baseline and charges nobody; line 10's 100 bytes
    // are read at the moment execution left it, not while it was running.
    expect(bytesOf(rec)).toEqual({ 10: 100, 20: 0, 30: 0 });
  });

  it('does not subtract what BASIC reclaims, nor charge it again', () => {
    const rec = new LineCostRecorder(
      PROFILE_SLICE_CYCLES,
      readings(1000, 1500, 1200, 1300),
    );
    rec.setEnabled(true);
    run(rec, [
      [8, 10],
      [8, 20],
      [8, 30],
      [8, 40],
    ]);
    // Line 20 gave 300 bytes back and is charged nothing for it rather than
    // -300; line 30 is charged the 100 it took, not the 400 the figure is up
    // on the low point, which would be the reclaimed bytes counted twice.
    expect(bytesOf(rec)).toEqual({ 10: 500, 20: 0, 30: 100, 40: 0 });
  });

  it('drops memory taken outside any BASIC line, as it drops the time', () => {
    const rec = new LineCostRecorder(
      PROFILE_SLICE_CYCLES,
      readings(1000, 1100, 5000),
    );
    rec.setEnabled(true);
    run(rec, [
      [8, 10],
      [8, null], // an INPUT wait, or the ROM back at its prompt
      [8, 20],
    ]);
    // The 3,900 bytes taken while no line was executing belong to no line of
    // the program, so they are dropped rather than parked on line 10 or 20.
    expect(bytesOf(rec)).toEqual({ 10: 100, 20: 0 });
  });

  it('re-baselines rather than charging across a reading it could not take', () => {
    const rec = new LineCostRecorder(
      PROFILE_SLICE_CYCLES,
      readings(1000, null, 5000),
    );
    rec.setEnabled(true);
    run(rec, [
      [8, 10],
      [8, 20],
      [8, 30],
    ]);
    // Mid-injection the machine's pointers say nothing. Charging the gap once
    // they mean something again would land the whole injection on one line.
    expect(bytesOf(rec)).toEqual({ 10: 0, 20: 0, 30: 0 });
  });

  it('offers no bytes at all until a reading has actually landed', () => {
    const rec = new LineCostRecorder(PROFILE_SLICE_CYCLES, readings(null));
    rec.setEnabled(true);
    run(rec, [
      [8, 10],
      [8, 20],
    ]);
    const drained = rec.drain()!;
    // Absent, not zero: a machine whose figures never arrived has not measured
    // that these lines took nothing.
    expect(drained.every((c) => c.allocated === undefined)).toBe(true);
    expect(drained.map((c) => c.cost)).toEqual([8, 8]);
  });

  it('offers no bytes on a machine that cannot report its memory', () => {
    const rec = new LineCostRecorder(PROFILE_SLICE_CYCLES);
    rec.setEnabled(true);
    run(rec, [
      [8, 10],
      [8, 20],
    ]);
    expect(rec.drain()!.every((c) => c.allocated === undefined)).toBe(true);
  });

  it('drops the baseline when disarmed, so a run is not charged the gap', () => {
    const rec = new LineCostRecorder(
      PROFILE_SLICE_CYCLES,
      readings(1000, 9000, 9100),
    );
    rec.setEnabled(true);
    run(rec, [[8, 10]]);
    rec.setEnabled(false);
    rec.setEnabled(true);
    run(rec, [
      [8, 20],
      [8, 30],
    ]);
    // Everything the machine did between the two runs - a reset, a boot, the
    // next program injected - would otherwise read as line 20 taking 8,000
    // bytes.
    expect(bytesOf(rec)).toEqual({ 20: 100, 30: 0 });
  });

  it('keeps a line’s bytes when its cycles fell in an earlier drain', () => {
    const rec = new LineCostRecorder(
      PROFILE_SLICE_CYCLES,
      readings(1000, 1500),
    );
    rec.setEnabled(true);
    run(rec, [[8, 10]]);
    expect(bytesOf(rec)).toEqual({ 10: 0 });
    // Line 10 was still executing when that drain happened, so the reading that
    // prices it is taken after it - and must still find its way to line 10.
    run(rec, [[8, 20]]);
    expect(bytesOf(rec)).toEqual({ 10: 500, 20: 0 });
  });
});
