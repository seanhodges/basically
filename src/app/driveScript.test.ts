import { describe, expect, it, vi } from 'vitest';
import type { MachineControl } from './machineControl';
import {
  DEFAULT_JOY_FRAMES,
  DEFAULT_WAIT_FOR_FRAMES,
  parseDriveScript,
  runDriveScript,
} from './driveScript';

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
    releaseAll: vi.fn(),
    ...overrides,
  };
}

describe('reading a drive script', () => {
  it('takes several actions on one line, separated by semicolons', () => {
    // The same rule for every caller: a schedule on a shell line and a script
    // the assistant writes are read by this one parser.
    expect(parseDriveScript('WAIT FOR "GO"; PRESS A; WAIT END')).toEqual([
      { kind: 'waitFor', needle: 'GO', maxFrames: DEFAULT_WAIT_FOR_FRAMES },
      { kind: 'press', names: ['A'] },
      { kind: 'waitEnd', maxFrames: DEFAULT_WAIT_FOR_FRAMES },
    ]);
  });

  it('leaves a semicolon inside a needle alone', () => {
    // Text on a screen is allowed to contain one, and splitting there would
    // wait for half a phrase and then fail on the other half.
    expect(parseDriveScript('WAIT FOR "READY; GO"')).toEqual([
      {
        kind: 'waitFor',
        needle: 'READY; GO',
        maxFrames: DEFAULT_WAIT_FOR_FRAMES,
      },
    ]);
  });

  it('reads the actions a program actually needs', () => {
    expect(
      parseDriveScript('WAIT FOR "NAME?"\nPRESS KeyF\nPRESS Enter\nWAIT 50'),
    ).toEqual([
      { kind: 'waitFor', needle: 'NAME?', maxFrames: expect.any(Number) },
      { kind: 'press', names: ['KeyF'] },
      { kind: 'press', names: ['Enter'] },
      { kind: 'wait', frames: 50 },
    ]);
  });

  it('takes a hold length on a press and a joystick', () => {
    expect(parseDriveScript('PRESS KeyA 8')).toEqual([
      { kind: 'press', names: ['KeyA'], holdFrames: 8 },
    ]);
    expect(parseDriveScript('JOY RIGHT 30')).toEqual([
      { kind: 'joystick', roles: ['right'], frames: 30 },
    ]);
  });

  it('defaults a joystick hold rather than pressing for a single frame', () => {
    // A one-frame hold is one a game's own input loop can miss entirely.
    expect(parseDriveScript('JOY FIRE')).toEqual([
      { kind: 'joystick', roles: ['fire1'], frames: DEFAULT_JOY_FRAMES },
    ]);
  });

  it('reads a diagonal as the two directions it is', () => {
    expect(parseDriveScript('JOY UP LEFT 5')).toEqual([
      { kind: 'joystick', roles: ['up', 'left'], frames: 5 },
    ]);
  });

  it('forgives the punctuation and casing a model adds', () => {
    expect(parseDriveScript('press KeyA.\n  wait 10;  ')).toEqual([
      { kind: 'press', names: ['KeyA'] },
      { kind: 'wait', frames: 10 },
    ]);
  });

  it('keeps a line it cannot read rather than dropping it', () => {
    // Silently ignoring a line reads as a line that worked, and the assistant
    // would then blame its program for a screen its driving never reached.
    const parsed = parseDriveScript('PRESS KeyA\nsomehow win the game');
    expect(parsed[1]).toEqual({
      kind: 'malformed',
      source: 'somehow win the game',
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
    expect(report.lines).toEqual(['"GO" appeared', 'pressed KeyA']);
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
    expect(report.lines.at(-1)).toContain('did not appear');
  });

  it('stops on a line it could not read, without guessing', () => {
    const control = stubControl();
    const report = runDriveScript(control, parseDriveScript('sing a song'));

    expect(report.ok).toBe(false);
    expect(report.lines[0]).toContain('could not understand');
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
      parseDriveScript('# get past the title screen\nPRESS SPACE\n  # done'),
    ).toEqual([{ kind: 'press', names: ['SPACE'] }]);
  });

  it('reads a chord as several names pressed together', () => {
    expect(parseDriveScript('PRESS SHIFT+P')).toEqual([
      { kind: 'press', names: ['SHIFT', 'P'] },
    ]);
    expect(parseDriveScript('PRESS SHIFT+CTRL+A 6')).toEqual([
      { kind: 'press', names: ['SHIFT', 'CTRL', 'A'], holdFrames: 6 },
    ]);
  });

  it('takes a cap on a wait for text, for a machine that is slow to it', () => {
    expect(parseDriveScript('WAIT FOR "READY" 900')).toEqual([
      { kind: 'waitFor', needle: 'READY', maxFrames: 900 },
    ]);
    // A needle with a number in it is still the needle, not a cap.
    expect(parseDriveScript('WAIT FOR "LEVEL 2"')).toEqual([
      {
        kind: 'waitFor',
        needle: 'LEVEL 2',
        maxFrames: DEFAULT_WAIT_FOR_FRAMES,
      },
    ]);
  });

  it('runs until the program stops, with or without a cap of its own', () => {
    expect(parseDriveScript('WAIT END\nWAIT END 120')).toEqual([
      { kind: 'waitEnd', maxFrames: DEFAULT_WAIT_FOR_FRAMES },
      { kind: 'waitEnd', maxFrames: 120 },
    ]);
  });

  it('waits for the end through the driver, and says so in the report', () => {
    const control = stubControl();
    const report = runDriveScript(control, parseDriveScript('WAIT END 120'));

    expect(control.waitForEnd).toHaveBeenCalledWith(120);
    expect(report.lines).toEqual(['the program stopped']);
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
    expect(report.lines.at(-1)).toContain('still running');
    expect(control.pressKeys).not.toHaveBeenCalled();
  });
});
