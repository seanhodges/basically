import { describe, expect, it } from 'vitest';
import { outlineCapabilities } from '../editor/programOutline';
import type { RunProfile } from '../app/runProfile';
import type { RunTiming } from '../app/runTiming';
import {
  describeProfile,
  describeTiming,
  describeVariables,
  profileFromSession,
  profileOp,
  timeOp,
  variablesOp,
} from './measure';
import { pureContext, stubSession } from './testSupport';

describe('the measurements', () => {
  const caps = outlineCapabilities([
    { word: 'GOSUB' },
    { word: 'GOTO' },
  ] as never);
  const SOURCE = '10 GOSUB 100\n20 GOTO 10\n100 REM DRAW\n110 RETURN\n';
  const measured: RunProfile = {
    bufferId: null,
    measuredLines: [10, 20, 100, 110],
    lines: [
      { line: 100, cost: 800 },
      { line: 10, cost: 200 },
    ],
    memory: {
      samples: [{ at: 1, used: 900, free: 15_484 }],
      peakUsed: 1200,
      totalBytes: 16_384,
      partial: false,
    },
    allocations: {
      lines: [
        { line: 100, bytes: 640, reclaimed: 200 },
        { line: 10, bytes: 0, reclaimed: 0 },
      ],
      accuracy: 'measured' as const,
    },
    elapsed: 4.2,
  };

  /** The prose for a profile, read through a session holding it. */
  const describe_ = (profile: RunProfile | null, canProfile = true) =>
    describeProfile(
      profileFromSession(
        stubSession({
          measurements: () => ({
            canProfile,
            profile,
            source: SOURCE,
            capabilities: caps,
          }),
        }),
      ),
    );

  it('reports the same accounting the user is shown', () => {
    const text = describe_(measured);
    expect(text).toContain('line 100: 80.0%');
    expect(text).toContain('line 10: 20.0%');
    // The rollup, so a routine's total needn't be added up by hand.
    expect(text).toContain('line 100 (DRAW)');
    expect(text).toContain('peaked at 1200 bytes of 16384 fitted');
    // ...and the caveat that makes a cheap-looking call site readable.
    expect(text).toContain('EXCLUDES the routines it calls');
    expect(text).toContain("this machine's own time");
  });

  it('reports which lines the memory went to, and how that is counted', () => {
    const text = describe_(measured);
    // The net, and the pair it came from: a line that takes 640 and gives 200
    // back is a different thing from one that took 440 and held it, and only
    // the first is a candidate for a reclaim pause.
    expect(text).toContain(
      'line 100: 440 bytes net (640 taken, 200 reclaimed)',
    );
    expect(text).toContain('line 100 (DRAW): 440 bytes net');
    expect(text).toContain('640 bytes taken over the run, 200 reclaimed');
    // The call site moved nothing, and is left out rather than listed as zero.
    expect(text).not.toContain('line 10: 0 bytes');
    expect(text).toContain('not what the routines it calls took');
    expect(text).not.toContain('APPROXIMATE');
  });

  it('says no line took memory rather than reporting a program that takes none', () => {
    const text = describe_({
      ...measured,
      allocations: { lines: [], accuracy: 'measured' },
    });
    expect(text).toContain('No line took memory this machine can account for');
  });

  it('says no readings were taken apart from none being taken', () => {
    const text = describe_({ ...measured, allocations: null });
    expect(text).toContain('No memory readings were taken');
    expect(text).not.toContain('No line took memory');
    // The account across the run is still reported: one half is not the other.
    expect(text).toContain('peaked at 1200 bytes');
  });

  it('marks a spread breakdown as approximate rather than as a reading', () => {
    const text = describe_({
      ...measured,
      allocations: {
        lines: [{ line: 100, bytes: 640, reclaimed: 0 }],
        accuracy: 'approximate',
      },
    });
    expect(text).toContain('line 100: 640 bytes net');
    expect(text).toContain('APPROXIMATE');
    expect(text).not.toContain('not what the routines it calls took');
  });

  it('says nothing has been measured rather than answering with nothing', () => {
    // An empty result would read as "measured, and nothing took any time",
    // which is exactly the wrong conclusion to hand a model asked to make a
    // program faster.
    const none = describe_(null);
    expect(none).toContain('Nothing has been measured');
    expect(none).not.toContain('%');
    expect(describe_({ ...measured, lines: [] })).toContain(
      'Nothing has been measured',
    );
  });

  it('says a machine that cannot be measured cannot be, not that it was slow', () => {
    expect(describe_(null, false)).toContain('cannot report which BASIC line');
    expect(
      profileFromSession(
        stubSession({
          measurements: () => ({
            canProfile: false,
            profile: measured,
            source: SOURCE,
            capabilities: caps,
          }),
        }),
      ),
    ).toEqual({ canProfile: false, measured: null });
  });

  it('says an unavailable memory account is unavailable, not zero', () => {
    const text = describe_({ ...measured, memory: null, allocations: null });
    expect(text).toContain('does not report its memory figures');
    expect(text).not.toMatch(/\b0 bytes/);
  });

  it('survives being written as JSON', () => {
    const session = stubSession({
      measurements: () => ({
        canProfile: true,
        profile: measured,
        source: SOURCE,
        capabilities: caps,
      }),
    });
    const outcome = profileOp.run({}, pureContext({ session }));
    expect(JSON.parse(JSON.stringify(outcome))).toEqual(outcome);
  });
});

describe('the timing', () => {
  const timing: RunTiming = {
    bufferId: null,
    seconds: 1.42,
    ending: 'finished',
  };
  const describe_ = (t: RunTiming | null) =>
    describeTiming(
      timeOp.run(
        {},
        pureContext({ session: stubSession({ timing: () => t }) }),
      ),
    );

  it('gives the duration and the ending in one answer', () => {
    const text = describe_(timing);
    expect(text).toContain('1.42s');
    expect(text).toContain('the program finished');
    expect(text).toContain("this machine's own time");
  });

  it('never lets a duration travel without what it means', () => {
    for (const ending of ['running', 'errored', 'stopped', 'paused'] as const) {
      const text = describe_({ ...timing, ending });
      expect(text).toContain('1.42s');
      expect(text).not.toContain('the program finished');
    }
    expect(describe_({ ...timing, ending: 'stopped' })).toContain(
      'still running when the run was stopped',
    );
  });

  it('says nothing has been timed rather than answering with a zero', () => {
    const text = describe_(null);
    expect(text).toContain('Nothing has been timed');
    expect(text).not.toContain('0.00s');
  });

  it('carries no browser bookkeeping into the outcome', () => {
    const outcome = timeOp.run(
      {},
      pureContext({ session: stubSession({ timing: () => timing }) }),
    );
    expect(outcome).toEqual({ timing: { seconds: 1.42, ending: 'finished' } });
  });
});

describe('the variables', () => {
  it('reports each as the machine displays it, without the machine handle', () => {
    const session = stubSession({
      variables: () => [
        { name: 'A', kind: 'number', value: '42', ref: { secret: true } },
        { name: 'N$', kind: 'string', value: '"HI"' },
      ],
    });
    const outcome = variablesOp.run({}, pureContext({ session }));
    expect(outcome).toEqual({
      variables: [
        { name: 'A', kind: 'number', value: '42' },
        { name: 'N$', kind: 'string', value: '"HI"' },
      ],
    });
    expect(describeVariables(outcome)).toContain('A = 42');
    expect(describeVariables(outcome)).toContain('N$ = "HI"');
  });

  it('says a machine that cannot report them cannot, and an empty program holds none', () => {
    expect(describeVariables({ variables: null })).toContain('cannot report');
    expect(describeVariables({ variables: [] })).toContain('no variables');
  });
});
