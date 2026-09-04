// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * A `--keys` schedule, from the text a caller wrote to the hook the headless
 * runner acts on the machine through.
 *
 * Neither function reads a file or touches `process`: the shim reads the option
 * text, prints the report and sets the exit code, exactly as it does for every
 * other operation.
 *
 * The grammar itself is not here. A schedule is the same line-per-action script
 * the assistant drives with (`src/app/driveScript.ts`), read by the same parser
 * and run by the same runner over the same driver - which is what makes a
 * schedule written for one caller mean the same thing to the other.
 */

import {
  parseDriveScript,
  runDriveScript,
  type DriveAction,
  type DriveReport,
} from '../app/driveScript';
import { createMachineControl } from '../app/machineControl';
import { RunError } from '../dialects/headless/runListing';
import type { Dialect, MachineEmulator } from '../dialects/types';

/**
 * Read the text of a `--keys` option into actions, refusing a line it cannot.
 *
 * Semicolons separate actions as newlines do, so a whole schedule fits on one
 * shell line; a semicolon inside a quoted needle is part of the needle, because
 * text on a screen is allowed to contain one.
 *
 * Throws where the parser merely records: a malformed line is the caller's
 * mistake and there is no reason to boot a machine before saying so, where the
 * assistant's own scripts arrive mid-conversation and are reported back to it.
 */
export function parseSchedule(text: string): DriveAction[] {
  const actions = parseDriveScript(splitActions(text).join('\n'));
  const bad = actions.find((action) => action.kind === 'malformed');
  if (bad) throw new RunError(`cannot read this line of --keys: ${bad.source}`);
  return actions;
}

/** One action per line, splitting on semicolons that are not inside quotes. */
function splitActions(text: string): string[] {
  const lines: string[] = [];
  let line = '';
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    if ((ch === ';' || ch === '\n') && !quoted) {
      lines.push(line);
      line = '';
      continue;
    }
    line += ch;
  }
  lines.push(line);
  return lines;
}

/** A schedule armed for one run, and the report it produced once it has run. */
export interface ScheduleHandle {
  /** Hand to {@link RunOptions.drive}. */
  drive: (machine: MachineEmulator, step: () => void) => void;
  /** What each action did, once the run is over; null before it has run. */
  report: DriveReport | null;
}

/**
 * Build the runner's `drive` callback over the shared driver.
 *
 * The report is captured on the handle rather than returned, because the runner
 * calls the hook rather than the caller: a caller that wants to know what the
 * schedule did - the shim printing it, and anything later checking a program
 * against it - reads it here once the run has finished, without re-running
 * anything.
 */
export function driveHook(
  dialect: Dialect,
  actions: readonly DriveAction[],
): ScheduleHandle {
  const handle: ScheduleHandle = {
    report: null,
    drive: (machine, step) => {
      const control = createMachineControl({
        machine,
        layout: dialect.keyboardLayout,
        // Through the machine's own port where it declares one, and as the
        // mapped keys where it does not - the same fallback the on-screen
        // controller makes, so a schedule reaches a program exactly as a person
        // playing it would.
        gamepadMode: dialect.joystickModes?.[0] ?? 'keymapped',
        fireButtons: dialect.joystickFireButtons ?? 1,
        step,
      });
      try {
        handle.report = runDriveScript(control, actions);
      } finally {
        // However the schedule ended, including part-way through a chord: a key
        // left down outlives the run and corrupts the screen it reports.
        control.releaseAll();
      }
    },
  };
  return handle;
}
