import { describe, expect, it } from 'vitest';
import {
  classifyAiRunFrame,
  finaliseExpectations,
  shouldOpenDebugSession,
  shouldRevealEmulator,
  shouldTakeMachineBack,
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
        { report: up ? OK : null, running: up ? true : null },
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
  outcome: ExpectationResult['outcome'],
  name = 'A',
): ExpectationResult {
  return {
    action: {
      kind: 'expect',
      expectation: { kind: 'variable', name, value: '1' },
      line: 1,
      source: `EXPECT VAR ${name} = 1`,
    },
    outcome,
    detail: `${name} holds something`,
  };
}

describe('finaliseExpectations', () => {
  it('fails an expectation that did not hold when the program ended cleanly', () => {
    const out = finaliseExpectations([result('failed')], { kind: 'ended-ok' });
    expect(out[0]!.outcome).toBe('failed');
  });

  it('keeps the failure of a program that was still running', () => {
    // The schedule was judged where it was written: an expectation that did
    // not hold at that point did not hold, and the way to say "later" is the
    // wait that says so.
    const out = finaliseExpectations([result('failed')], {
      kind: 'still-running',
    });
    expect(out[0]!.outcome).toBe('failed');
  });

  it('leaves it unchecked when the program never started', () => {
    // Nothing ran, so nothing the program did can be at fault - reporting a
    // failure would send the assistant to fix a program that never ran.
    const out = finaliseExpectations([result('failed')], {
      kind: 'never-started',
    });
    expect(out[0]).toMatchObject({
      outcome: 'unevaluated',
      detail: 'the program never started',
    });
  });

  it('judges nothing at all when the run errored', () => {
    // The error is the failure, and it travels as a correction of its own.
    expect(
      finaliseExpectations([result('failed'), result('done', 'B')], {
        kind: 'errored',
        report: FAILED,
      }),
    ).toEqual([]);
  });

  it('keeps a pass whatever the verdict', () => {
    // The game-loop case: the expectation held where it was written and the
    // program never returned to READY, so the verdict is still-running. It
    // still held.
    for (const outcome of [
      { kind: 'ended-ok' } as const,
      { kind: 'still-running' } as const,
      { kind: 'never-started' } as const,
    ]) {
      expect(finaliseExpectations([result('done')], outcome)[0]!.outcome).toBe(
        'done',
      );
    }
  });

  it('leaves an already-unchecked expectation unchecked, never failed', () => {
    // A variable expectation on a machine that cannot report variables: the
    // prompt should have stopped it being written, and it must not be reported
    // as a failure of the program.
    const cannotCheck: ExpectationResult = {
      ...result('unevaluated'),
      detail: 'this machine cannot report its variables',
    };
    const out = finaliseExpectations([cannotCheck], { kind: 'ended-ok' });
    expect(out[0]).toMatchObject({
      outcome: 'unevaluated',
      detail: 'this machine cannot report its variables',
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

describe('shouldTakeMachineBack', () => {
  it('takes the machine back for a run the user asked for', () => {
    // Otherwise a machine the assistant is holding still stays held through the
    // user's own run, which shows their program and never advances a frame.
    expect(shouldTakeMachineBack({ checking: false })).toBe(true);
  });

  it('leaves the driver alone for a check', () => {
    // The check is what *gives* the assistant the machine: the driver is
    // registered by the frame the check draws, so dropping it on the way in
    // would take the machine back from nobody.
    expect(shouldTakeMachineBack({ checking: true })).toBe(false);
  });
});
