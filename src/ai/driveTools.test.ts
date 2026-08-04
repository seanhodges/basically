import { describe, expect, it, vi } from 'vitest';
import type { MachineControl } from '../app/machineControl';
import {
  DEFAULT_JOY_FRAMES,
  describeDriving,
  driveToolDefinitions,
  parseDriveScript,
  runDriveScript,
  type DriveReport,
} from './driveTools';

/** A control that says yes to everything, recording what it was asked. */
function stubControl(overrides: Partial<MachineControl> = {}): MachineControl {
  return {
    keyNames: () => ['KeyA', 'Enter'],
    pressKeys: vi.fn(() => ({ ok: true, frames: 5 })),
    joystick: vi.fn(() => ({ ok: true, frames: 12 })),
    advance: vi.fn((n: number) => ({ ok: true, frames: n })),
    waitForText: vi.fn(() => ({ ok: true, frames: 30 })),
    readText: () => ({ lines: ['READY'], cols: 5, rows: 1 }),
    releaseAll: vi.fn(),
    ...overrides,
  };
}

describe('reading a drive script', () => {
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

  it('carry no machine specifics, so one block serves every dialect', () => {
    // The per-machine part is the key names, and those live in the system
    // prompt, which is already a per-dialect constant.
    const json = JSON.stringify(driveToolDefinitions());
    for (const machineWord of ['ZX81', 'Spectrum', 'Commodore', 'KeyA']) {
      expect(json).not.toContain(machineWord);
    }
  });
});
