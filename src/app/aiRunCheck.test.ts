import { describe, expect, it } from 'vitest';
import {
  classifyAiRunFrame,
  AI_CHECK_MAX_FRAMES,
  AI_CHECK_ABS_MAX_FRAMES,
  type AiRunFrame,
  type AiRunFrameCounts,
} from './aiRunCheck';
import type { MachineReport } from '../dialects/types';

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
