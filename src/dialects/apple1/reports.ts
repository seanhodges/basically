// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineReport } from '../types';

/**
 * Recover Integer BASIC's runtime report from the terminal, behind the
 * machine's `readReport()`, so the IDE can notice a program that stopped on an
 * error and offer a fix.
 *
 * There is nothing structured to read: the interpreter keeps no report
 * variable, it *prints* `*** SYNTAX ERR` and returns to its `>` prompt. So the
 * source is the terminal grid, as it is on the Altair and the Commodores. The
 * machine clears the terminal on every `loadProgram`, so anything found belongs
 * to the run just made.
 *
 * The names below are the interpreter's own, read out of the message table at
 * `$EB00` in `public/roms/apple1/apple1.rom` rather than transcribed from a manual -
 * which is also why there are exactly sixteen of them. A name missing from the
 * table (a different build of the interpreter) still reports, carrying the
 * printed line as its message.
 */

/**
 * What each `*** ... ERR` means. The interpreter prints the terse name and
 * nothing else; the sentences are this project's.
 */
const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  '>32767': 'A result the interpreter cannot hold; division by zero too',
  'TOO LONG': 'Line too long to store',
  SYNTAX: 'Syntax error',
  'MEM FULL': 'The program and its variables have met',
  'TOO MANY PARENS': 'Expression nested too deeply',
  STRING: 'A string where a number belongs, or the reverse',
  'NO END': 'A statement after the last END',
  'BAD BRANCH': 'GOTO or GOSUB to a line that does not exist',
  '>8 GOSUBS': 'More than eight GOSUBs nested',
  'BAD RETURN': 'RETURN with no GOSUB to return from',
  '>8 FORS': 'More than eight FOR loops nested',
  'BAD NEXT': 'NEXT with no FOR to continue',
  '>255': 'A value over 255 where the interpreter takes a byte',
  RANGE: 'Subscript outside the DIM',
  DIM: 'DIM of a variable that already exists',
  'STR OVFL': 'String longer than the space DIM reserved',
  // The seventeenth name is the tail of the sixteenth: `NO END` sits at $EB31
  // and the report for falling off the last line points three bytes into it,
  // printing `*** END ERR`. A real error on this machine, which is why every
  // program written for it finishes with END.
  END: 'The program ran past its last line',
};

/**
 * The printed report. Not anchored to column 0: the interpreter breaks the line
 * first only when its own column counter says the carriage has moved, so an
 * error raised after a `PRINT ... ;` lands on the end of the program's output.
 */
const ERROR_LINE = /\*\*\* (.+?) ERR\b/;

/** The line number, printed on its own line under the report. */
const STOPPED_AT = /STOPPED AT (\d+)/;

/** Integer BASIC's prompt, and the only thing that says it is idle. */
const PROMPT = '>';

/**
 * The report the terminal shows, or null when it shows neither an error nor the
 * prompt - which is what a running program looks like.
 *
 * `rows` is the terminal grid top to bottom. Errors win over the prompt,
 * because both are on screen after a failed run: the interpreter prints
 * `*** RANGE ERR`, then `STOPPED AT 20`, then a fresh `>`. A prompt on its own
 * is reported as a genuine (non-error) report rather than as null, because it
 * is a real observation - the interpreter is idle - and the post-run check in
 * `src/app/aiRunCheck.ts` counts a machine that says nothing at all as one that
 * never started.
 *
 * `STOPPED AT` is looked for below the report rather than beside it because the
 * two are separate prints, and it is genuinely absent for the one error a
 * program reaches by not stopping: `*** END ERR` has no line to name.
 */
export function readApple1Report(
  rows: readonly string[],
): MachineReport | null {
  for (let i = 0; i < rows.length; i++) {
    const match = ERROR_LINE.exec(rows[i]!);
    if (!match) continue;
    const code = match[1]!;
    const stopped = findStoppedAt(rows, i + 1);
    return {
      isError: true,
      message: ERROR_MESSAGES[code] ?? rows[i]!.trim(),
      code,
      ...(stopped === null ? {} : { line: stopped }),
    };
  }
  return isAtPrompt(rows) ? { isError: false, message: PROMPT } : null;
}

/** The line the interpreter says it stopped at, searching down from `from`. */
function findStoppedAt(rows: readonly string[], from: number): number | null {
  for (let i = from; i < rows.length; i++) {
    const match = STOPPED_AT.exec(rows[i]!);
    if (match) return Number(match[1]);
  }
  return null;
}

/**
 * True when the last thing on the terminal is the bare `>` prompt, i.e. nothing
 * is running.
 *
 * It has to be the last non-blank row and nothing else on it, so a program that
 * prints a `>` partway through its output does not read as one that has
 * finished. A program whose *last* printed line is exactly `>` is the one case
 * this gets wrong, and there is no second source to check it against.
 */
export function isAtPrompt(rows: readonly string[]): boolean {
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]!.trim();
    if (row === '') continue;
    return row === PROMPT;
  }
  return false;
}
