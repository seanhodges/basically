// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineReport } from '../types';

/**
 * Recover the BASIC runtime report - an error, or OK - from the terminal,
 * behind the machine's `readReport()`, so the IDE can notice a program that
 * stopped on an error and offer a fix.
 *
 * Every other machine here reads this from somewhere structured: a report-code
 * system variable on the Sinclair ROMs, the MOS error block on the BBC. The
 * Altair has neither. Its errors are *printed* - `?SN ERROR IN 100`, in the
 * terse two-letter codes 8K BASIC uses - so the only source is the terminal
 * output itself, which makes this closest to the Commodore screen-scan in
 * `src/emulator/c64/reports.ts`.
 *
 * The grid is scanned rather than the serial stream, so a report stays readable
 * after the program has printed past it, and the machine clears the terminal on
 * every `loadProgram`, so anything found belongs to the run just made.
 *
 * Nothing here needs the copyright interpreter image to have been read: the
 * printed forms are the ones documented in the MITS *Altair BASIC Reference
 * Manual*, and an unrecognised code still produces a report carrying the line
 * as printed rather than being dropped.
 */

/**
 * 8K BASIC's error codes, from the error-message appendix of the MITS manual.
 * The interpreter prints the two-letter code, never the sentence; the sentences
 * are the manual's own.
 *
 * The list is not load-bearing for *detecting* an error - {@link ERROR_LINE}
 * does that structurally - only for saying what one means. A code missing from
 * here (a different 8K build, or a later ROM's addition) still reports, with
 * the printed line as its message.
 */
const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  NF: 'NEXT without FOR',
  SN: 'Syntax error',
  RG: 'RETURN without GOSUB',
  OD: 'Out of data',
  FC: 'Illegal function call',
  OV: 'Overflow',
  OM: 'Out of memory',
  UL: 'Undefined line number',
  BS: 'Bad subscript',
  DD: 'Redimensioned array',
  '/0': 'Division by zero',
  ID: 'Illegal direct',
  TM: 'Type mismatch',
  OS: 'Out of string space',
  LS: 'String too long',
  ST: 'String formula too complex',
  CN: "Can't continue",
  UF: 'Undefined user function',
};

/**
 * `?XX ERROR` anywhere in a line, optionally followed by the line it happened
 * in. Not anchored to column 0 the way the Commodore scan is: BASIC only breaks
 * the line first when its own column counter says the carriage has moved, so an
 * error raised after a `PRINT` with a trailing semicolon lands on the end of
 * the program's own output.
 */
const ERROR_LINE = /\?([A-Z/][A-Z0-9]) ERROR(?: IN (\d+))?/;

/** What BASIC prints, alone on a line, when it is back at its prompt. */
const OK_PROMPT = 'OK';

/**
 * The report the terminal shows, or null when it shows neither an error nor a
 * prompt - which is what a running program looks like.
 *
 * `rows` is the terminal grid top to bottom, trailing blanks trimmed.
 *
 * Errors win over the prompt, because both are on screen after a failed run:
 * BASIC prints `?SN ERROR IN 100` and then returns to `OK`. A prompt on its own
 * is reported as a genuine (non-error) report rather than as null, because it
 * is a real observation - BASIC has finished and is waiting - and the post-run
 * check in `src/app/aiRunCheck.ts` counts a machine that says nothing at all as
 * one that never started.
 */
export function readAltair8800Report(
  rows: readonly string[],
): MachineReport | null {
  for (const row of rows) {
    const match = ERROR_LINE.exec(row);
    if (!match) continue;
    const code = match[1]!;
    return {
      isError: true,
      message: ERROR_MESSAGES[code] ?? row.trim(),
      code,
      line: match[2] === undefined ? undefined : Number(match[2]),
    };
  }
  return isAtOkPrompt(rows) ? { isError: false, message: OK_PROMPT } : null;
}

/**
 * True when the last thing on the terminal is BASIC's `OK` prompt, i.e. nothing
 * is running.
 *
 * The prompt has to be the last non-blank line and nothing else on it: a
 * program that prints the word OK partway through its output would otherwise
 * read as one that had finished. That is as far as this can be taken without
 * reading the interpreter's own state, and it is why a program *whose last
 * printed line is exactly* `OK` is the one case this gets wrong.
 */
export function isAtOkPrompt(rows: readonly string[]): boolean {
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]!.trim();
    if (row === '') continue;
    return row === OK_PROMPT;
  }
  return false;
}
