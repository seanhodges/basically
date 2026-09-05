// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineReport, MachineScreenText } from '../types';
import { BASIC_PROMPT } from './addresses';

/**
 * Recover Integer BASIC's runtime report from the screen, behind the machine's
 * `readReport()`, so the IDE can notice a program that stopped on an error and
 * offer a fix.
 *
 * There is nothing structured to read: the interpreter keeps no report
 * variable, it *prints* `*** SYNTAX ERR` and returns to its `>` prompt. So the
 * source is the text page, as it is on the Apple I, the Altair and the
 * Commodores. The machine clears the screen on every `loadProgram`, so anything
 * found belongs to the run just made.
 *
 * The names below are the interpreter's own, read out of the message table at
 * `$EB00` in `public/roms/apple2/apple2.rom` rather than transcribed from a manual,
 * and each was then provoked at the machine. They are *not* the Apple I's list
 * despite the same interpreter: this ROM has sixteen deep FOR and GOSUB stacks
 * where that one has eight, and spells the two reports `16 FORS` and
 * `16 GOSUBS`; and running off the last line answers `NO END` here where the
 * Apple I prints `END`. A name missing from the table (a different build of the
 * interpreter) still reports, carrying the printed line as its message.
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
  'NO END': 'The program ran past its last line',
  'BAD BRANCH': 'GOTO or GOSUB to a line that does not exist',
  '16 GOSUBS': 'More than sixteen GOSUBs nested',
  'BAD RETURN': 'RETURN with no GOSUB to return from',
  '16 FORS': 'More than sixteen FOR loops nested',
  'BAD NEXT': 'NEXT with no FOR to continue',
  '>255': 'A value over 255 where the interpreter takes a byte',
  RANGE: 'Subscript outside the DIM, or a DIM the workspace cannot hold',
  DIM: 'DIM of a variable that already exists',
  'STR OVFL': 'String longer than the space DIM reserved',
};

/**
 * The printed report. Not anchored to column 0: the interpreter breaks the line
 * first only when its own column counter says the carriage has moved, so an
 * error raised after a `PRINT ... ;` lands on the end of the program's output.
 */
const ERROR_LINE = /\*\*\* (.+?) ERR\b/;

/** The line number, printed on its own line under the report. */
const STOPPED_AT = /STOPPED AT (\d+)/;

/**
 * The report the screen shows, or null when it shows neither a report nor the
 * prompt - which is what a running program looks like.
 *
 * `screen` is what the video counter is actually displaying, and it is null in
 * full-screen graphics. That is the one blind spot: the interpreter prints into
 * the text page whether or not anybody can see it, so a program that fails
 * while `GR` is on with no text window reports nothing until it switches back.
 * Reading the hidden page anyway would be worse - it still holds whatever was
 * printed before the program cleared the screen with `GR`.
 *
 * Errors win over everything else, because both are on screen after a failed
 * run: the interpreter prints `*** RANGE ERR`, then `STOPPED AT 20`, then a
 * fresh `>`. A bare `STOPPED AT` with no error above it is CTRL-C - the one
 * key that stops a running program on this machine - and is a real observation
 * rather than a failure, so it reports the line it stopped on with
 * `isError: false`. A prompt on its own is reported the same way, because the
 * post-run check in `src/app/aiRunCheck.ts` counts a machine that says nothing
 * at all as one that never started.
 *
 * `STOPPED AT` is looked for below the report rather than beside it because the
 * two are separate prints, and it is genuinely absent for the one error a
 * program reaches by not stopping: `*** NO END ERR` has no line to name.
 */
export function readApple2Report(
  screen: MachineScreenText | null,
): MachineReport | null {
  const rows = screen?.lines ?? [];
  for (let i = 0; i < rows.length; i++) {
    const match = ERROR_LINE.exec(rows[i]!);
    if (!match) continue;
    const code = match[1]!.trim();
    const stopped = findStoppedAt(rows, i + 1);
    return {
      isError: true,
      message: ERROR_MESSAGES[code] ?? rows[i]!.trim(),
      code,
      ...(stopped === null ? {} : { line: stopped }),
    };
  }
  const stopped = findStoppedAt(rows, 0);
  if (stopped !== null) {
    return {
      isError: false,
      message: 'Stopped from the keyboard with CTRL-C',
      line: stopped,
    };
  }
  return isAtPrompt(rows) ? { isError: false, message: BASIC_PROMPT } : null;
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
 * True when the last thing on screen is the bare `>` prompt, i.e. nothing is
 * running.
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
    return row === BASIC_PROMPT;
  }
  return false;
}
