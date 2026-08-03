import { describe, expect, it } from 'vitest';
import {
  classifyAiRunFrame,
  finaliseExpectations,
  latchExpectationSample,
  shouldOpenDebugSession,
  shouldRevealEmulator,
  AI_CHECK_MAX_FRAMES,
  AI_CHECK_ABS_MAX_FRAMES,
  type AiRunFrame,
  type AiRunFrameCounts,
} from './aiRunCheck';
import type { MachineReport } from '../dialects/types';
import type { ExpectationResult } from '../ai/expectations';

const OK: MachineReport = { isError: false, message: 'OK', code: '0' };
const FAILED: MachineReport = {
  isError: true,
  message: 'Undefined variable',
  code: '2',
  line: 10,
};

const START: AiRunFrameCounts = { readyFrames: 0, totalFrames: 0 };

/** Feed the same frame repeatedly until the check reaches a verdict. */
function watch(frame: AiRunFrame, maxFrames = AI_CHECK_ABS_MAX_FRAMES + 10) {
  let counts = START;
  for (let i = 1; i <= maxFrames; i++) {
    const verdict = classifyAiRunFrame(frame, counts);
    if (verdict.done) return { outcome: verdict.outcome, frames: i };
    counts = {
      readyFrames: verdict.readyFrames,
      totalFrames: verdict.totalFrames,
    };
  }
  throw new Error('the check never reached a verdict');
}

describe('classifyAiRunFrame', () => {
  it('ends on an error report, carrying the report itself', () => {
    const verdict = classifyAiRunFrame(
      { report: FAILED, running: true },
      START,
    );
    expect(verdict).toEqual({
      done: true,
      outcome: { kind: 'errored', report: FAILED },
    });
  });

  it('reports an error even when the machine says a program is running', () => {
    // The error is what matters; whether the ROM has wound the program up yet
    // is beside the point.
    const { outcome } = watch({ report: FAILED, running: true });
    expect(outcome).toEqual({ kind: 'errored', report: FAILED });
  });

  it('ends as ended-ok as soon as the machine says nothing is running', () => {
    const verdict = classifyAiRunFrame({ report: null, running: false }, START);
    expect(verdict).toEqual({ done: true, outcome: { kind: 'ended-ok' } });
  });

  it('keeps watching while the machine cannot answer yet', () => {
    // A machine mid-boot: no report, no run state. Neither count of "up".
    const verdict = classifyAiRunFrame({ report: null, running: null }, START);
    expect(verdict).toEqual({ done: false, readyFrames: 0, totalFrames: 1 });
  });

  it('calls a program still going when the running window expires', () => {
    const { outcome, frames } = watch({ report: OK, running: true });
    expect(outcome).toEqual({ kind: 'still-running' });
    expect(frames).toBe(AI_CHECK_MAX_FRAMES);
  });

  it('never says ended-ok for a machine that cannot answer the run state', () => {
    // The Sinclair case: a non-error report every frame and no run state. It
    // must read as a program that ran, never as one that finished.
    const { outcome } = watch({ report: OK, running: undefined });
    expect(outcome).toEqual({ kind: 'still-running' });
  });

  it('counts only frames where the machine is up toward the running window', () => {
    // A machine that stays down for a while must not have the window eaten by
    // its own boot: the verdict lands the full window *after* it comes up.
    let counts = START;
    for (let i = 0; i < 100; i++) {
      const verdict = classifyAiRunFrame(
        { report: null, running: null },
        counts,
      );
      expect(verdict.done).toBe(false);
      if (verdict.done) return;
      counts = {
        readyFrames: verdict.readyFrames,
        totalFrames: verdict.totalFrames,
      };
    }
    expect(counts).toEqual({ readyFrames: 0, totalFrames: 100 });
  });

  it('calls it never-started when the machine never comes up at all', () => {
    const { outcome, frames } = watch({ report: null, running: null });
    expect(outcome).toEqual({ kind: 'never-started' });
    expect(frames).toBe(AI_CHECK_ABS_MAX_FRAMES);
  });

  it('calls a machine that came up but never finished still-running at the cap', () => {
    // Up only every other frame, so the absolute cap arrives before the
    // running window fills. It ran - it just never got to report an ending.
    let counts = START;
    let outcome;
    for (let i = 0; i < AI_CHECK_ABS_MAX_FRAMES; i++) {
      const up = i % 5 === 0;
      const verdict = classifyAiRunFrame(
        { report: up ? OK : null, running: up ? undefined : null },
        counts,
      );
      if (verdict.done) {
        outcome = verdict.outcome;
        break;
      }
      counts = {
        readyFrames: verdict.readyFrames,
        totalFrames: verdict.totalFrames,
      };
    }
    expect(outcome).toEqual({ kind: 'still-running' });
  });
});

/** One expectation result, with only the fields the latch rules care about. */
function result(
  status: ExpectationResult['status'],
  name = 'A',
): ExpectationResult {
  return {
    expectation: {
      kind: 'var',
      name,
      expected: '1',
      source: `VAR ${name} = 1`,
    },
    status,
  };
}

describe('latchExpectationSample', () => {
  it('takes the first sample as-is', () => {
    const sample = [result('failed'), result('passed', 'B')];
    expect(latchExpectationSample(null, sample)).toEqual(sample);
  });

  it('keeps a pass once it has held', () => {
    const latched = latchExpectationSample(null, [result('passed')]);
    // The value was overwritten by the time of the next sample; it still passed.
    const next = latchExpectationSample(latched, [result('failed')]);
    expect(next[0]!.status).toBe('passed');
  });

  it('lets a failure be replaced by a later pass', () => {
    const latched = latchExpectationSample(null, [result('failed')]);
    const next = latchExpectationSample(latched, [result('passed')]);
    expect(next[0]!.status).toBe('passed');
  });

  it('latches each expectation independently', () => {
    const first = latchExpectationSample(null, [
      result('passed', 'A'),
      result('failed', 'B'),
    ]);
    const second = latchExpectationSample(first, [
      result('failed', 'A'),
      result('passed', 'B'),
    ]);
    expect(second.map((r) => r.status)).toEqual(['passed', 'passed']);
  });

  it('does not latch an unchecked result into a pass', () => {
    const latched = latchExpectationSample(null, [result('unchecked')]);
    expect(latchExpectationSample(latched, [result('failed')])[0]!.status).toBe(
      'failed',
    );
  });
});

describe('finaliseExpectations', () => {
  // One row per line of the design's outcome table.
  it('fails an expectation that never held when the program ended cleanly', () => {
    const out = finaliseExpectations([result('failed')], { kind: 'ended-ok' });
    expect(out[0]!.status).toBe('failed');
  });

  it('leaves it unchecked when the program was still running', () => {
    const out = finaliseExpectations([result('failed')], {
      kind: 'still-running',
    });
    expect(out[0]).toMatchObject({
      status: 'unchecked',
      reason: 'the program was still running when the check ended',
    });
  });

  it('leaves it unchecked when the program never started', () => {
    const out = finaliseExpectations([result('failed')], {
      kind: 'never-started',
    });
    expect(out[0]).toMatchObject({
      status: 'unchecked',
      reason: 'the program never started',
    });
  });

  it('judges nothing at all when the run errored', () => {
    // The error is the failure, and it travels as a correction of its own.
    expect(
      finaliseExpectations([result('failed'), result('passed', 'B')], {
        kind: 'errored',
        report: FAILED,
      }),
    ).toEqual([]);
  });

  it('keeps a pass whatever the verdict', () => {
    // The game-loop case: the expectation held on an early sample and the run
    // never returned to READY, so the verdict is still-running. It still passed.
    for (const outcome of [
      { kind: 'ended-ok' } as const,
      { kind: 'still-running' } as const,
      { kind: 'never-started' } as const,
    ]) {
      expect(finaliseExpectations([result('passed')], outcome)[0]!.status).toBe(
        'passed',
      );
    }
  });

  it('leaves an already-unchecked expectation unchecked, never failed', () => {
    // A variable expectation on a machine that cannot report variables: the
    // prompt should have stopped it being written, and it must not be reported
    // as a failure of the program.
    const cannotCheck: ExpectationResult = {
      ...result('unchecked'),
      reason: 'this machine cannot report its variables',
    };
    const out = finaliseExpectations([cannotCheck], { kind: 'ended-ok' });
    expect(out[0]).toMatchObject({
      status: 'unchecked',
      reason: 'this machine cannot report its variables',
    });
  });

  it('returns nothing when nothing was stated', () => {
    expect(finaliseExpectations([], { kind: 'ended-ok' })).toEqual([]);
  });
});

describe('shouldOpenDebugSession', () => {
  it('opens one for an ordinary run on a machine that can step', () => {
    expect(
      shouldOpenDebugSession({
        checking: false,
        debuggable: true,
        canStep: true,
      }),
    ).toBe(true);
  });

  it('never opens one for a check, however debuggable the machine', () => {
    // The hang this prevents: a session would pause on whatever breakpoint the
    // user has set, a paused loop stops advancing frames, and the check would
    // never reach a verdict - so every reply would hang for anyone with a
    // breakpoint anywhere. `debuggable` says what the machine can do, not what
    // the user is doing, so it cannot be the thing that decides this.
    expect(
      shouldOpenDebugSession({
        checking: true,
        debuggable: true,
        canStep: true,
      }),
    ).toBe(false);
  });

  it('opens none where the machine or dialect cannot step', () => {
    expect(
      shouldOpenDebugSession({
        checking: false,
        debuggable: true,
        canStep: false,
      }),
    ).toBe(false);
    expect(
      shouldOpenDebugSession({
        checking: false,
        debuggable: false,
        canStep: true,
      }),
    ).toBe(false);
  });
});

describe('shouldRevealEmulator', () => {
  it('brings the machine forward for a run the user asked for', () => {
    expect(shouldRevealEmulator({ checking: false })).toBe(true);
  });

  it('leaves the screen and the keys alone for a check', () => {
    // The check starts on its own while the user is reading the reply, so
    // switching the tab layout to the preview - or moving the keys onto the
    // canvas - would take the assistant off the screen mid-answer for something
    // nobody asked for.
    expect(shouldRevealEmulator({ checking: true })).toBe(false);
  });
});
