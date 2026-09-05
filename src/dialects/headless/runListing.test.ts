// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { runListing, screenLines } from './runListing';
import { getDialect } from '../registry';
import { hasRom } from '../bootHarness';
import { createMachineControl } from '../../app/machineControl';
import {
  parseDriveScript,
  runDriveScript,
  stepLines,
} from '../../app/driveScript';
import type { DriveReport } from '../../app/driveScript';

/**
 * The hook a headless run acts on the machine through.
 *
 * Driven on the C64 deliberately: it is one of the machines that queues its
 * boot-and-inject on a microtask, and the driver's frame loop is synchronous
 * where the runner yields every twenty frames for exactly that. So this is the
 * machine most likely to break the assumption that a schedule may run its
 * frames straight through once `loadProgram` and its yield have landed.
 *
 * Budget: one boot, and a wait-for-text predicate rather than a frame count, so
 * the run costs the frames the program needs and no more.
 */

/** A program that stops at a prompt and cannot reach its result unaided. */
const WAITS_FOR_A_KEY = [
  '10 PRINT "PRESS"',
  '20 GET A$',
  '30 IF A$ = "" THEN 20',
  '40 PRINT "WENT ON"',
].join('\n');

/** Cap on each wait: a second and a half of this machine's own time. */
const WAIT_FRAMES = 900;

const SCHEDULE = [
  '# get past the prompt and see what the program then printed',
  `WAIT FOR "PRESS" ${WAIT_FRAMES}`,
  'PRESS A',
  `WAIT FOR "WENT ON" ${WAIT_FRAMES}`,
  `WAIT END ${WAIT_FRAMES}`,
].join('\n');

/** The runner's `drive` callback over the shared driver and script vocabulary. */
function scheduleHook(dialectId: string, script: string) {
  const dialect = getDialect(dialectId);
  const captured: { report?: DriveReport } = {};
  return {
    captured,
    drive: (
      machine: Parameters<typeof createMachineControl>[0]['machine'],
      step: () => void,
    ) => {
      const control = createMachineControl({
        machine,
        layout: dialect.keyboardLayout,
        gamepadMode: 'keymapped',
        fireButtons: dialect.joystickFireButtons ?? 1,
        step,
      });
      try {
        captured.report = runDriveScript(control, parseDriveScript(script));
      } finally {
        control.releaseAll();
      }
    },
  };
}

describe('acting on the machine between frames', () => {
  it('drives a program past the keypress it was waiting on', async (ctx) => {
    if (!hasRom(getDialect('commodore64'))) {
      ctx.skip("the C64's ROMs are not in this checkout");
    }
    const hook = scheduleHook('commodore64', SCHEDULE);

    const result = await runListing({
      machine: 'commodore64',
      source: WAITS_FOR_A_KEY,
      drive: hook.drive,
      // Exactly the schedule's frames and no others, so the count below says
      // what it means; the settling a program's own ending earns is proved by
      // every undriven run.
      settleFrames: 0,
    });

    expect(stepLines(hook.captured.report?.steps ?? []).join(' | ')).toBe(
      '"PRESS" appeared | pressed A | "WENT ON" appeared | the program stopped',
    );
    expect(hook.captured.report?.ok).toBe(true);

    // The result of the driving, on the screen the runner reports: without it
    // the program never leaves its prompt.
    expect(screenLines(result.screen).join('\n')).toContain('WENT ON');

    // The schedule's frames are counted and reported beside the run's own,
    // and with no `frames` asked for there are no others: the run ends where
    // the schedule left it rather than at a cap.
    expect(result.driveFrames).toBeGreaterThan(0);
    expect(result.frames).toBe(result.driveFrames);
    // `WAIT END` ran the program out, so the runner saw it stop and settled.
    expect(result.ended).toBe(true);
  }, 120_000);

  it('runs the frames the caller asked for after the schedule, and no more', async (ctx) => {
    if (!hasRom(getDialect('commodore64'))) {
      ctx.skip("the C64's ROMs are not in this checkout");
    }
    const extra = 20;
    const hook = scheduleHook(
      'commodore64',
      `WAIT FOR "PRESS" ${WAIT_FRAMES}\nPRESS A`,
    );

    const result = await runListing({
      machine: 'commodore64',
      source: WAITS_FOR_A_KEY,
      drive: hook.drive,
      frames: extra,
      settleFrames: 0,
    });

    expect(hook.captured.report?.ok).toBe(true);
    expect(result.frames).toBe(result.driveFrames + extra);
    // The moment after the key, which is what `--frames` is for: a game needs
    // a beat to draw before its screen is worth reading.
    expect(screenLines(result.screen).join('\n')).toContain('WENT ON');
  }, 120_000);
});
