// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { driveHook, parseSchedule } from './drive';
import { getDialect } from '../dialects/registry';
import { RunError } from '../dialects/headless/runListing';
import type { MachineEmulator } from '../dialects/types';

/**
 * Reading a `--keys` option, and arming the hook a run acts through.
 *
 * No machine is booted: the schedule is text until the runner calls the hook,
 * and the hook itself is checked against a machine stub that records what it
 * was asked. What a press actually does to a ROM is proved on real machines by
 * `src/app/machineControl.test.ts` and the every-machine crosscheck in
 * `src/ai/machineObservability.test.ts`.
 */

describe('reading a schedule the caller wrote', () => {
  it('takes several actions on one line, separated by semicolons', () => {
    expect(parseSchedule('WAIT FOR "GO"; PRESS A; WAIT END')).toEqual([
      { kind: 'waitFor', needle: 'GO', maxFrames: expect.any(Number) },
      { kind: 'press', names: ['A'] },
      { kind: 'waitEnd', maxFrames: expect.any(Number) },
    ]);
  });

  it('leaves a semicolon inside a needle alone', () => {
    // Text on a screen is allowed to contain one, and splitting there would
    // wait for half a phrase and then fail on the other half.
    expect(parseSchedule('WAIT FOR "READY; GO"')).toEqual([
      { kind: 'waitFor', needle: 'READY; GO', maxFrames: expect.any(Number) },
    ]);
  });

  it('reads newlines as well, so a schedule may come from a file', () => {
    expect(parseSchedule('# start it\nPRESS SPACE\nWAIT 30')).toEqual([
      { kind: 'press', names: ['SPACE'] },
      { kind: 'wait', frames: 30 },
    ]);
  });

  it('refuses a line it cannot read, naming it', () => {
    // Thrown rather than recorded: there is no reason to boot a machine before
    // telling a caller their schedule is not a schedule.
    expect(() => parseSchedule('PRESS A; win the game')).toThrow(RunError);
    expect(() => parseSchedule('PRESS A; win the game')).toThrow(
      /win the game/,
    );
  });
});

/** A machine that records what was pressed and never runs a program. */
function stubMachine(): MachineEmulator & { pressed: string[] } {
  const pressed: string[] = [];
  return {
    pressed,
    setKey: (token: string, down: boolean) => {
      if (down) pressed.push(token);
    },
    releaseAllKeys: () => {},
    isProgramRunning: () => true,
    readScreenText: () => ({ lines: ['GO'], cols: 2, rows: 1 }),
  } as unknown as MachineEmulator & { pressed: string[] };
}

describe('arming a run with a schedule', () => {
  it('runs the schedule through the driver and keeps what it reported', () => {
    const handle = driveHook(
      getDialect('zx81'),
      parseSchedule('WAIT FOR "GO"; PRESS A'),
    );
    // Before the runner calls it there is nothing to report; a caller reading
    // the report is reading a run that has happened.
    expect(handle.report).toBeNull();

    const machine = stubMachine();
    let frames = 0;
    handle.drive(machine, () => frames++);

    expect(handle.report?.ok).toBe(true);
    expect(handle.report?.lines).toEqual(['"GO" appeared', 'pressed A']);
    // The runner's own step is what the schedule spends, so its frames are the
    // run's frames rather than a count kept on the side.
    expect(frames).toBeGreaterThan(0);
    // The vocabulary resolved to this machine's own cell for the letter.
    expect(machine.pressed).toContain('KeyA');
  });

  it('lets go of every key however the schedule ended', () => {
    const handle = driveHook(
      getDialect('zx81'),
      parseSchedule('PRESS A; PRESS NOTAKEY'),
    );
    const released: string[] = [];
    const machine = stubMachine();
    machine.setKey = (token: string, down: boolean) => {
      if (!down) released.push(token);
    };
    let releasedAll = false;
    machine.releaseAllKeys = () => {
      releasedAll = true;
    };

    handle.drive(machine, () => {});

    // The schedule failed part-way; a key left down would outlive the run and
    // corrupt the screen it reports.
    expect(handle.report?.ok).toBe(false);
    expect(handle.report?.lines.at(-1)).toContain('no key called "NOTAKEY"');
    expect(releasedAll).toBe(true);
    expect(released).toContain('KeyA');
  });
});
