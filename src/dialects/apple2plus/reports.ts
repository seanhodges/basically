// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineReport, MachineScreenText } from '../types';
import { BASIC_PROMPT } from './addresses';

/**
 * Recover Applesoft's runtime report from the screen, behind the machine's
 * `readReport()`, so the IDE can notice a program that stopped on an error and
 * offer a fix.
 *
 * There is nothing structured to read. `PEEK(222)` looks like the answer and is
 * not: the ROM's one store to `$DE` is on the `ONERR` path at `$F2E9`, beside
 * the line number it copies out of `CURLIN`, so a program with no handler armed
 * leaves the cell holding whatever the last *handled* error was - which is
 * worse than nothing. What the interpreter always does is *print*
 * `?SYNTAX ERROR IN 30` and return to its `]` prompt, so
 * the source is the text page, as it is on the sibling, the Altair and the
 * Commodores. The machine clears the screen on every `loadProgram`, so anything
 * found belongs to the run just made.
 *
 * The names below are the interpreter's own, read out of the message table at
 * `$D260` in `public/roms/apple2plus/apple2plus.rom` rather than transcribed from a
 * manual, and each was then provoked at the machine. The **printed shape is not
 * the sibling's** and the reader is not ported across: this one prints a `?`, a
 * name, ` ERROR`, and then ` IN <line>` on the same line, where Integer BASIC
 * prints `*** <name> ERR` and puts `STOPPED AT <line>` on the next line. A name
 * missing from the table (a different build of the interpreter) still reports,
 * carrying the printed line as its message.
 */

/**
 * What each `?... ERROR` means, one per entry in the ROM's table. The
 * interpreter prints the terse name and nothing else; the sentences are this
 * project's.
 */
const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  'NEXT WITHOUT FOR': 'NEXT with no FOR to continue',
  SYNTAX: 'Syntax error',
  'RETURN WITHOUT GOSUB': 'RETURN with no GOSUB to return from',
  'OUT OF DATA': 'READ with no DATA left to read',
  'ILLEGAL QUANTITY': 'An argument outside what the function accepts',
  OVERFLOW: 'A number too large for the five-byte float',
  'OUT OF MEMORY': 'The program, its variables and its strings have met',
  "UNDEF'D STATEMENT": 'GOTO or GOSUB to a line that does not exist',
  'BAD SUBSCRIPT': 'Subscript outside the DIM',
  "REDIM'D ARRAY": 'DIM of an array that already exists',
  'DIVISION BY ZERO': 'Division by zero',
  'ILLEGAL DIRECT': 'A statement that only works inside a program',
  'TYPE MISMATCH': 'A string where a number belongs, or the reverse',
  'STRING TOO LONG': 'A string longer than 255 characters',
  'FORMULA TOO COMPLEX': 'Expression nested too deeply',
  "CAN'T CONTINUE": 'CONT with no stopped program to resume',
  "UNDEF'D FUNCTION": 'FN of a function no DEF FN defined',
};

/**
 * The printed report.
 *
 * Not anchored to column 0, so an error raised after a `PRINT ... ;` is still
 * found. The interpreter does break the line first - it prints a carriage
 * return whenever its column counter says the carriage has moved - but the
 * screen wraps at 40 columns without one, and this is the cheaper thing to be
 * tolerant of.
 *
 * The name is taken lazily so the ` IN` of a longer message cannot end it
 * early, and `ERROR` is matched with a word boundary so a program printing
 * `?SOMETHING ERRORS` does not read as a report.
 */
const ERROR_LINE = /\?(.+?) ERROR\b( IN (\d+))?/;

/**
 * CTRL-C, which is the one key that stops a running program here. The
 * interpreter prints this on its own line with no `?` and no ` ERROR`, so it
 * cannot be folded into the pattern above.
 */
const BREAK_LINE = /\bBREAK IN (\d+)/;

/**
 * The report the screen shows, or null when it shows neither a report nor the
 * prompt - which is what a running program looks like.
 *
 * `screen` is what the video counter is actually displaying, and it is null in
 * full-screen graphics. That is the one blind spot, and it is a larger one here
 * than on the sibling because this interpreter has `HGR`: the report is printed
 * into the text page whether or not anybody can see it, so a program that fails
 * under a full-screen `HGR` reports nothing until it switches back. Reading the
 * hidden page anyway would be worse - it still holds whatever was printed
 * before the program cleared the screen.
 *
 * Errors win over everything else, because both are on screen after a failed
 * run: the interpreter prints the report and then a fresh `]`. A `BREAK IN` is
 * a real observation rather than a failure, so it reports the line it stopped
 * on with `isError: false`. A prompt on its own is reported the same way,
 * because the post-run check in `src/app/aiRunCheck.ts` counts a machine that
 * says nothing at all as one that never started.
 */
export function readApple2plusReport(
  screen: MachineScreenText | null,
): MachineReport | null {
  const rows = screen?.lines ?? [];
  for (const row of rows) {
    const match = ERROR_LINE.exec(row);
    if (!match) continue;
    const code = match[1]!.trim();
    const line = match[3];
    return {
      isError: true,
      message: ERROR_MESSAGES[code] ?? row.trim(),
      code,
      ...(line === undefined ? {} : { line: Number(line) }),
    };
  }
  for (const row of rows) {
    const match = BREAK_LINE.exec(row);
    if (match) {
      return {
        isError: false,
        message: 'Stopped from the keyboard with CTRL-C',
        line: Number(match[1]),
      };
    }
  }
  return isAtPrompt(rows) ? { isError: false, message: BASIC_PROMPT } : null;
}

/**
 * True when the last thing on screen is the bare `]` prompt, i.e. nothing is
 * running.
 *
 * It has to be the last non-blank row and nothing else on it, so a program that
 * prints a `]` partway through its output does not read as one that has
 * finished - and the sign-on banner, which carries a `]` in the middle of
 * `APPLE ][`, never matches at all. A program whose *last* printed line is
 * exactly `]` is the one case this gets wrong, and there is no second source to
 * check it against.
 */
export function isAtPrompt(rows: readonly string[]): boolean {
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]!.trim();
    if (row === '') continue;
    return row === BASIC_PROMPT;
  }
  return false;
}
