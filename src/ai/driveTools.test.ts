import { describe, expect, it } from 'vitest';
import {
  describeDriving,
  describeProfile,
  describeTiming,
  driveToolDefinitions,
  DRIVE_TOOL,
  LOOK_TOOL,
  PROFILE_TOOL,
  TIME_TOOL,
} from './driveTools';
import type { DriveReport } from '../app/driveScript';
import { outlineCapabilities } from '../editor/programOutline';
import type { RunProfile } from '../app/runProfile';
import type { RunTiming } from '../app/runTiming';

describe('what the user is told', () => {
  const report = (over: Partial<DriveReport> = {}): DriveReport => ({
    ok: true,
    lines: [],
    frames: 0,
    sentInput: false,
    ...over,
  });

  it('says what was pressed when something was', () => {
    expect(
      describeDriving([
        report({ sentInput: true, lines: ['pressed KeyF', 'pressed Enter'] }),
      ]),
    ).toBe('Tried the program: pressed KeyF, pressed Enter.');
  });

  it('says nothing when the assistant only waited and looked', () => {
    // Nothing happened the user could not have seen for themselves.
    expect(describeDriving([report({ lines: ['waited 50 frames'] })])).toBe('');
  });

  it('says nothing at all when there was no driving', () => {
    expect(describeDriving([])).toBe('');
  });
});

describe('the tool definitions', () => {
  it('are the same bytes every time, so the cached prefix survives', () => {
    // They render ahead of the system prompt: a set that varies between turns
    // invalidates the prompt and the whole thread behind it.
    expect(JSON.stringify(driveToolDefinitions())).toBe(
      JSON.stringify(driveToolDefinitions()),
    );
  });

  it('are a fixed set, whatever the machine is doing', () => {
    // The set is a constant with nothing to read: there is no argument to pass
    // that could make a tool appear or disappear part-way through a
    // conversation, which is what would cost the prefix behind it.
    expect(driveToolDefinitions().map((t) => t.name)).toEqual([
      DRIVE_TOOL,
      LOOK_TOOL,
      PROFILE_TOOL,
      TIME_TOOL,
    ]);
    expect(driveToolDefinitions.length).toBe(0);
  });

  it('is the same set on every turn of a conversation', () => {
    // What a conversation is offered must not change according to whether a
    // machine happens to be running at that moment: a tool set that appears or
    // disappears part-way through invalidates the cached prefix behind it.
    // Nothing in this call reads the machine, the store, or the clock, so ten
    // turns of one conversation are ten identical blocks.
    const turns = Array.from({ length: 10 }, () =>
      JSON.stringify(driveToolDefinitions()),
    );
    expect(new Set(turns).size).toBe(1);
  });

  it('tells the assistant that a timing costs a run', () => {
    const time = driveToolDefinitions().find((t) => t.name === TIME_TOOL)!;
    expect(time.description).toContain('COSTS A RUN');
    // The duration and the ending in one answer, so a second call is never
    // needed to find out whether the number means anything.
    expect(time.description).toContain('how that timing ended');
    expect(time.description).toContain('own time');
  });

  it('tells the assistant what a line’s cost excludes', () => {
    const profile = driveToolDefinitions().find(
      (t) => t.name === PROFILE_TOOL,
    )!;
    expect(profile.description).toContain('charged to that routine');
    expect(profile.description).toContain('own time');
  });

  it('carry no machine specifics, so one block serves every dialect', () => {
    // The per-machine part is the key names, and those live in the system
    // prompt, which is already a per-dialect constant.
    const json = JSON.stringify(driveToolDefinitions());
    for (const machineWord of ['ZX81', 'Spectrum', 'Commodore', 'KeyA']) {
      expect(json).not.toContain(machineWord);
    }
  });
});

describe('describeProfile', () => {
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

  it('reports the same accounting the user is shown', () => {
    const text = describeProfile(measured, SOURCE, caps, true);
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
    const text = describeProfile(measured, SOURCE, caps, true);
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
    // The caveat that makes a cheap-looking call site readable still rides
    // along, so the assistant cannot read a line's figure as covering what it
    // calls.
    expect(text).toContain('not what the routines it calls took');
    expect(text).not.toContain('APPROXIMATE');
  });

  it('says no line took memory rather than reporting a program that takes none', () => {
    // A machine whose own figures cannot see where memory goes must not have
    // the assistant conclude the program is frugal.
    const text = describeProfile(
      { ...measured, allocations: { lines: [], accuracy: 'measured' } },
      SOURCE,
      caps,
      true,
    );
    expect(text).toContain('No line took memory this machine can account for');
    expect(text).not.toContain('bytes in all');
  });

  it('says no readings were taken apart from none being taken', () => {
    const text = describeProfile(
      { ...measured, allocations: null },
      SOURCE,
      caps,
      true,
    );
    expect(text).toContain('No memory readings were taken');
    expect(text).not.toContain('No line took memory');
  });

  it('marks a spread breakdown as approximate rather than as a reading', () => {
    const text = describeProfile(
      {
        ...measured,
        allocations: {
          lines: [{ line: 100, bytes: 640, reclaimed: 0 }],
          accuracy: 'approximate',
        },
      },
      SOURCE,
      caps,
      true,
    );
    expect(text).toContain('line 100: 640 bytes net');
    expect(text).toContain('APPROXIMATE');
    expect(text).toContain('not as a measurement');
    // Nothing was charged to a line, so the sentence about what a line is
    // charged must not appear beside figures that were spread.
    expect(text).not.toContain('not what the routines it calls took');
  });

  it('offers no memory breakdown from a machine that cannot attribute', () => {
    const text = describeProfile(
      { ...measured, allocations: null },
      SOURCE,
      caps,
      true,
    );
    expect(text).not.toContain('Which lines took the memory');
    expect(text).not.toContain('No line took memory');
    // The account across the run is still reported: one half is not the other.
    expect(text).toContain('peaked at 1200 bytes');
  });

  it('says nothing has been measured rather than answering with nothing', () => {
    // An empty result would read as "measured, and nothing took any time",
    // which is exactly the wrong conclusion to hand an assistant asked to make
    // a program faster.
    const none = describeProfile(null, SOURCE, caps, true);
    expect(none).toContain('Nothing has been measured');
    expect(none).not.toContain('%');

    const measuredNothing = describeProfile(
      { ...measured, lines: [] },
      SOURCE,
      caps,
      true,
    );
    expect(measuredNothing).toContain('Nothing has been measured');
  });

  it('says a machine that cannot be measured cannot be, not that it was slow', () => {
    const text = describeProfile(null, SOURCE, caps, false);
    expect(text).toContain('cannot report which BASIC line');
  });

  it('says an unavailable memory account is unavailable, not zero', () => {
    // Both halves go together: the per-line bytes are read out of the same
    // figure the account is, so a machine that has no figure has neither.
    const text = describeProfile(
      { ...measured, memory: null, allocations: null },
      SOURCE,
      caps,
      true,
    );
    expect(text).toContain('does not report its memory figures');
    expect(text).not.toMatch(/\b0 bytes/);
  });
});

describe('describeTiming', () => {
  const timing: RunTiming = {
    bufferId: null,
    seconds: 1.42,
    ending: 'finished',
  };

  it('gives the duration and the ending in one answer', () => {
    const text = describeTiming(timing);
    expect(text).toContain('1.42s');
    expect(text).toContain('the program finished');
    expect(text).toContain("this machine's own time");
  });

  it('never lets a duration travel without what it means', () => {
    // The same number is a measurement of the program under one ending and a
    // fact about when somebody got bored under another, so an assistant given
    // the bare seconds could compare two things that are not comparable.
    for (const ending of ['running', 'errored', 'stopped', 'paused'] as const) {
      const text = describeTiming({ ...timing, ending });
      expect(text).toContain('1.42s');
      expect(text).not.toContain('the program finished');
    }
    expect(describeTiming({ ...timing, ending: 'stopped' })).toContain(
      'still running when the run was stopped',
    );
  });

  it('says nothing has been timed rather than answering with a zero', () => {
    const text = describeTiming(null);
    expect(text).toContain('Nothing has been timed');
    expect(text).not.toContain('0.00s');
  });
});
