import { describe, expect, it, vi } from 'vitest';
import type { MachineControl } from './machineControl';
import {
  DEFAULT_JOY_FRAMES,
  DEFAULT_WAIT_FOR_FRAMES,
  parseDriveScript,
  runDriveScript,
  stepLines,
  type DriveAction,
} from './driveScript';

/**
 * The actions without where each was written, so the assertions below stay
 * about the grammar. The line and the source have tests of their own.
 */
function parsed(script: string): Omit<DriveAction, 'line' | 'source'>[] {
  return parseDriveScript(script).map(
    ({ line: _line, source: _source, ...rest }) => rest,
  );
}

/** A control that says yes to everything, recording what it was asked. */
function stubControl(overrides: Partial<MachineControl> = {}): MachineControl {
  return {
    pressKeys: vi.fn(() => ({ ok: true, frames: 5 })),
    joystick: vi.fn(() => ({ ok: true, frames: 12 })),
    advance: vi.fn((n: number) => ({ ok: true, frames: n })),
    waitForText: vi.fn(() => ({ ok: true, frames: 30 })),
    waitForEnd: vi.fn(() => ({ ok: true, frames: 40 })),
    programState: () => false,
    readText: () => ({ lines: ['READY'], cols: 5, rows: 1 }),
    variables: () => [{ name: 'A', kind: 'number', value: '1' }],
    releaseAll: vi.fn(),
    ...overrides,
  };
}

describe('reading a drive script', () => {
  it('takes several actions on one line, separated by semicolons', () => {
    // The same rule for every caller: a schedule on a shell line and a script
    // the assistant writes are read by this one parser.
    expect(parsed('WAIT FOR "GO"; PRESS A; WAIT END')).toEqual([
      { kind: 'waitFor', needle: 'GO', maxFrames: DEFAULT_WAIT_FOR_FRAMES },
      { kind: 'press', names: ['A'] },
      { kind: 'waitEnd', maxFrames: DEFAULT_WAIT_FOR_FRAMES },
    ]);
  });

  it('leaves a semicolon inside a needle alone', () => {
    // Text on a screen is allowed to contain one, and splitting there would
    // wait for half a phrase and then fail on the other half.
    expect(parsed('WAIT FOR "READY; GO"')).toEqual([
      {
        kind: 'waitFor',
        needle: 'READY; GO',
        maxFrames: DEFAULT_WAIT_FOR_FRAMES,
      },
    ]);
  });

  it('reads the actions a program actually needs', () => {
    expect(
      parsed('WAIT FOR "NAME?"\nPRESS KeyF\nPRESS Enter\nWAIT 50'),
    ).toEqual([
      { kind: 'waitFor', needle: 'NAME?', maxFrames: expect.any(Number) },
      { kind: 'press', names: ['KeyF'] },
      { kind: 'press', names: ['Enter'] },
      { kind: 'wait', frames: 50 },
    ]);
  });

  it('takes a hold length on a press and a joystick', () => {
    expect(parsed('PRESS KeyA 8')).toEqual([
      { kind: 'press', names: ['KeyA'], holdFrames: 8 },
    ]);
    expect(parsed('JOY RIGHT 30')).toEqual([
      { kind: 'joystick', roles: ['right'], frames: 30 },
    ]);
  });

  it('defaults a joystick hold rather than pressing for a single frame', () => {
    // A one-frame hold is one a game's own input loop can miss entirely.
    expect(parsed('JOY FIRE')).toEqual([
      { kind: 'joystick', roles: ['fire1'], frames: DEFAULT_JOY_FRAMES },
    ]);
  });

  it('reads a diagonal as the two directions it is', () => {
    expect(parsed('JOY UP LEFT 5')).toEqual([
      { kind: 'joystick', roles: ['up', 'left'], frames: 5 },
    ]);
  });

  it('forgives the punctuation and casing a model adds', () => {
    expect(parsed('press KeyA.\n  wait 10;  ')).toEqual([
      { kind: 'press', names: ['KeyA'] },
      { kind: 'wait', frames: 10 },
    ]);
  });

  it('keeps a line it cannot read rather than dropping it', () => {
    // Silently ignoring a line reads as a line that worked, and the assistant
    // would then blame its program for a screen its driving never reached.
    expect(parseDriveScript('PRESS KeyA\nsomehow win the game')[1]).toEqual({
      kind: 'malformed',
      source: 'somehow win the game',
      line: 2,
    });
  });

  it('treats a joystick control this machine has no name for as malformed', () => {
    expect(parseDriveScript('JOY SIDEWAYS 5')[0]!.kind).toBe('malformed');
  });

  it('refuses to wait for nothing', () => {
    expect(parseDriveScript('WAIT FOR ""')[0]!.kind).toBe('malformed');
  });
});

describe('running a drive script', () => {
  it('carries out every action in order and totals what it cost', () => {
    const control = stubControl();
    const report = runDriveScript(
      control,
      parseDriveScript('WAIT FOR "GO"\nPRESS KeyA'),
    );

    expect(report.ok).toBe(true);
    expect(report.frames).toBe(35);
    expect(stepLines(report.steps)).toEqual(['"GO" appeared', 'pressed KeyA']);
  });

  it('stops at the first action that fails', () => {
    const control = stubControl({
      waitForText: vi.fn(() => ({
        ok: false,
        frames: 300,
        detail: '"GO" did not appear within 300 frames',
      })),
    });

    const report = runDriveScript(
      control,
      parseDriveScript('WAIT FOR "GO"\nPRESS KeyA'),
    );

    // Every action after a failure was written for a screen that never
    // arrived; doing them anyway drives the machine somewhere nobody asked for.
    expect(report.ok).toBe(false);
    expect(control.pressKeys).not.toHaveBeenCalled();
    expect(stepLines(report.steps).at(-1)).toContain('did not appear');
  });

  it('stops on a line it could not read, without guessing', () => {
    const control = stubControl();
    const report = runDriveScript(control, parseDriveScript('sing a song'));

    expect(report.ok).toBe(false);
    expect(stepLines(report.steps)[0]).toContain('could not understand');
    expect(control.pressKeys).not.toHaveBeenCalled();
  });

  it('knows whether it actually sent input or only watched', () => {
    const control = stubControl();
    expect(runDriveScript(control, parseDriveScript('WAIT 20')).sentInput).toBe(
      false,
    );
    expect(
      runDriveScript(control, parseDriveScript('PRESS KeyA')).sentInput,
    ).toBe(true);
  });

  it('counts input as sent even when the press itself failed', () => {
    // It reached the machine; whether it did what was wanted is another
    // question, and the user still cannot account for the screen without it.
    const control = stubControl({
      pressKeys: vi.fn(() => ({ ok: false, frames: 2, detail: 'no such key' })),
    });
    expect(
      runDriveScript(control, parseDriveScript('PRESS KeyZ')).sentInput,
    ).toBe(true);
  });
});

describe('what a written schedule adds to the vocabulary', () => {
  it('drops a comment rather than reading it as an action', () => {
    expect(
      parsed('# get past the title screen\nPRESS SPACE\n  # done'),
    ).toEqual([{ kind: 'press', names: ['SPACE'] }]);
  });

  it('reads a chord as several names pressed together', () => {
    expect(parsed('PRESS SHIFT+P')).toEqual([
      { kind: 'press', names: ['SHIFT', 'P'] },
    ]);
    expect(parsed('PRESS SHIFT+CTRL+A 6')).toEqual([
      { kind: 'press', names: ['SHIFT', 'CTRL', 'A'], holdFrames: 6 },
    ]);
  });

  it('takes a cap on a wait for text, for a machine that is slow to it', () => {
    expect(parsed('WAIT FOR "READY" 900')).toEqual([
      { kind: 'waitFor', needle: 'READY', maxFrames: 900 },
    ]);
    // A needle with a number in it is still the needle, not a cap.
    expect(parsed('WAIT FOR "LEVEL 2"')).toEqual([
      {
        kind: 'waitFor',
        needle: 'LEVEL 2',
        maxFrames: DEFAULT_WAIT_FOR_FRAMES,
      },
    ]);
  });

  it('runs until the program stops, with or without a cap of its own', () => {
    expect(parsed('WAIT END\nWAIT END 120')).toEqual([
      { kind: 'waitEnd', maxFrames: DEFAULT_WAIT_FOR_FRAMES },
      { kind: 'waitEnd', maxFrames: 120 },
    ]);
  });

  it('waits for the end through the driver, and says so in the report', () => {
    const control = stubControl();
    const report = runDriveScript(control, parseDriveScript('WAIT END 120'));

    expect(control.waitForEnd).toHaveBeenCalledWith(120);
    expect(stepLines(report.steps)).toEqual(['the program stopped']);
    expect(report.frames).toBe(40);
    // Waiting is not input: the user can account for the screen without being
    // told the schedule watched it.
    expect(report.sentInput).toBe(false);
  });

  it('reports a program that never stopped as the failing action', () => {
    const control = stubControl({
      waitForEnd: vi.fn(() => ({
        ok: false,
        frames: 120,
        detail: 'the program was still running after 120 frames',
      })),
    });
    const report = runDriveScript(
      control,
      parseDriveScript('WAIT END 120\nPRESS A'),
    );

    expect(report.ok).toBe(false);
    expect(stepLines(report.steps).at(-1)).toContain('still running');
    expect(control.pressKeys).not.toHaveBeenCalled();
  });
});

describe('the expectations a schedule states', () => {
  it('reads every form it is described in', () => {
    expect(
      parsed(
        'EXPECT "GAME OVER"\nEXPECT NOT "ERROR"\nEXPECT STOPPED\n' +
          'EXPECT RUNNING\nEXPECT VAR TOTAL = 42\nEXPECT SHOWS a red circle',
      ),
    ).toEqual([
      {
        kind: 'expect',
        expectation: { kind: 'text', needle: 'GAME OVER', negated: false },
      },
      {
        kind: 'expect',
        expectation: { kind: 'text', needle: 'ERROR', negated: true },
      },
      { kind: 'expect', expectation: { kind: 'state', running: false } },
      { kind: 'expect', expectation: { kind: 'state', running: true } },
      {
        kind: 'expect',
        expectation: { kind: 'variable', name: 'TOTAL', value: '42' },
      },
      {
        kind: 'expect',
        expectation: { kind: 'shows', description: 'a red circle' },
      },
    ]);
  });

  it('still reads the spellings written before the vocabularies became one', () => {
    // Saved conversations contain these, and a restored thread whose
    // expectations came back as malformed would be a record the IDE had
    // stopped being able to read.
    expect(
      parsed('SCREEN CONTAINS "HI"\nVAR A = 1\nSCREEN SHOWS a maze').map((a) =>
        a.kind === 'expect' ? a.expectation : a.kind,
      ),
    ).toEqual([
      { kind: 'text', needle: 'HI', negated: false },
      { kind: 'variable', name: 'A', value: '1' },
      { kind: 'shows', description: 'a maze' },
    ]);
  });

  it('keeps an expectation that states nothing to check rather than dropping it', () => {
    for (const line of ['EXPECT ""', 'EXPECT VAR A =', 'EXPECT SHOWS']) {
      expect(parseDriveScript(line)[0]!.kind, line).toBe('malformed');
    }
  });

  it('numbers the line an action was written on, comments and all', () => {
    // A failure is reported by its line, so the line has to survive comments
    // being dropped and several actions sharing one line.
    expect(
      parseDriveScript('# why\nPRESS A; PRESS B\n\nEXPECT "HI"').map(
        (a) => [a.line, a.source] as const,
      ),
    ).toEqual([
      [2, 'PRESS A'],
      [2, 'PRESS B'],
      [4, 'EXPECT "HI"'],
    ]);
  });

  it('holds an expectation that is true, without spending a frame on it', () => {
    const control = stubControl();
    const report = runDriveScript(
      control,
      parseDriveScript('EXPECT "READY"\nEXPECT STOPPED\nEXPECT VAR A = 1'),
    );

    expect(report.ok).toBe(true);
    expect(report.frames).toBe(0);
    expect(report.steps.map((s) => s.outcome)).toEqual([
      'done',
      'done',
      'done',
    ]);
  });

  it('stops the schedule at an expectation that does not hold, naming it', () => {
    const control = stubControl();
    const report = runDriveScript(
      control,
      parseDriveScript('EXPECT "GAME OVER"\nPRESS KeyA'),
    );

    expect(report.ok).toBe(false);
    expect(control.pressKeys).not.toHaveBeenCalled();
    const failed = report.steps.at(-1)!;
    expect(failed.action.line).toBe(1);
    expect(failed.detail).toContain('"GAME OVER" is not on the screen');
  });

  it('reports what nobody present can settle as neither passed nor failed', () => {
    const control = stubControl();
    const report = runDriveScript(
      control,
      parseDriveScript('EXPECT SHOWS a circle\nEXPECT "READY"'),
    );

    // Never folded into the verdict: a silent pass would be a claim nobody
    // made, and a failure would fail correct programs.
    expect(report.ok).toBe(true);
    expect(report.steps.map((s) => s.outcome)).toEqual(['unevaluated', 'done']);
    expect(stepLines(report.steps)[0]).toContain('unevaluated');
  });

  it('leaves a reading the machine cannot give as unevaluated too', () => {
    const report = runDriveScript(
      stubControl({ variables: () => null, programState: () => null }),
      parseDriveScript('EXPECT VAR A = 1\nEXPECT STOPPED'),
    );

    expect(report.ok).toBe(true);
    expect(report.steps.map((s) => s.outcome)).toEqual([
      'unevaluated',
      'unevaluated',
    ]);
  });

  it('fails an expectation about a variable the program never made', () => {
    const report = runDriveScript(
      stubControl(),
      parseDriveScript('EXPECT VAR NOPE = 1'),
    );

    expect(report.ok).toBe(false);
    expect(report.steps.at(-1)!.detail).toContain('no variable called NOPE');
  });

  it('forgives quoting and number formatting, never a different value', () => {
    const control = stubControl({
      variables: () => [
        { name: 'T', kind: 'number', value: ' 42' },
        { name: 'N$', kind: 'string', value: '"HI"' },
      ],
    });
    expect(
      runDriveScript(control, parseDriveScript('EXPECT VAR T = 42.0')).ok,
    ).toBe(true);
    expect(
      runDriveScript(control, parseDriveScript('EXPECT VAR N$ = HI')).ok,
    ).toBe(true);
    expect(
      runDriveScript(control, parseDriveScript('EXPECT VAR T = 43')).ok,
    ).toBe(false);
  });

  it('never matches an element against an array-shaped value', () => {
    // An array is reported as its shape plus a truncated preview, not as its
    // elements, so an expectation about one element cannot be satisfied at
    // all - and quietly passing it would be worse than failing it.
    const control = stubControl({
      variables: () => [
        { name: 'B()', kind: 'number-array', value: '(10) = 1, 2, 3, \u2026' },
      ],
    });
    expect(
      runDriveScript(control, parseDriveScript('EXPECT VAR B(0) = 1')).ok,
    ).toBe(false);
    expect(
      runDriveScript(control, parseDriveScript('EXPECT VAR B() = 1')).ok,
    ).toBe(false);
  });

  it('expects text to be absent as readily as present', () => {
    const control = stubControl();
    expect(
      runDriveScript(control, parseDriveScript('EXPECT NOT "ERROR"')).ok,
    ).toBe(true);
    expect(
      runDriveScript(control, parseDriveScript('EXPECT NOT "READY"')).ok,
    ).toBe(false);
  });
});
