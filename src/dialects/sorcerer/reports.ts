// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineReport } from '../types';

/**
 * How a run ended, as Exidy Standard BASIC reported it, recovered from the
 * screen behind the machine's `readReport()` - so the IDE can notice a program
 * that stopped on an error and offer a fix.
 *
 * **The screen is the only source, because this interpreter keeps no error
 * state.** 8K BASIC has no ON ERROR and no ERR/ERL, so there is nothing like
 * the MSX's ERRFLG or the Sinclair report-code byte to read: the code exists
 * only in a register on the way to being printed. That puts this with the
 * Altair's reader and the Commodore screen-scan rather than with the machines
 * that answer structurally, and it is why the traps below are traps at all.
 *
 * Reading the grid rather than a serial stream means a report stays legible
 * after the program has printed past it, and the machine resets on every
 * `loadProgram`, so whatever is on screen belongs to the run just made.
 */

/**
 * The interpreter's error codes, from the table of two-letter spellings in the
 * ROM PAC at 0xC232 - the nineteen entries the interpreter can print, in its
 * own order. The sentences beside them are the Exidy Software Manual's.
 *
 * The list is not what *detects* an error - {@link ERROR_LINE} does that
 * structurally - only what says one means. A code missing from here still
 * reports, carrying the printed line as its message.
 *
 * MO is the entry an Altair reader would not expect: 8K BASIC as MITS shipped
 * it stopped at UF, and this ROM has one more.
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
  MO: 'Missing operand',
};

/**
 * `?XX ERROR` anywhere in a line, with the line it happened in where BASIC
 * printed one.
 *
 * Not anchored to column 0: BASIC breaks the line first only when its own
 * column counter says the carriage has moved, so an error raised after a PRINT
 * with a trailing semicolon lands on the end of the program's own output.
 */
const ERROR_LINE = /\?([A-Z/][A-Z0-9]) ERROR(?: IN (\d+))?/;

/** What the interpreter prints when a program is stopped rather than failed. */
const BREAK_LINE = /BREAK(?: IN (\d+))?/;

/** What BASIC prints, alone on a line, when it is back at its prompt. */
const READY_PROMPT = 'READY';

/**
 * The block the Monitor's screen driver parks at the point the next character
 * will go.
 *
 * It is a real byte in screen RAM, not an overlay, so the row below the prompt
 * is never blank and "the last thing on screen" would otherwise always be the
 * cursor. Skipped rather than rendered away, which costs the one case below.
 */
const CURSOR = '_';

/**
 * The report the screen shows, or null when it shows neither an error, a break
 * nor a prompt - which is what a running program looks like.
 *
 * `rows` is the screen grid top to bottom.
 *
 * The three are tried in that order because more than one can be on screen at
 * once: a failed run prints `?SN ERROR IN 100` and then `READY`, and a stopped
 * one prints `BREAK IN 20` and then `READY`. A prompt on its own is a genuine
 * report rather than null - BASIC has finished and is waiting - because the
 * post-run check in `src/app/aiRunCheck.ts` counts a machine that says nothing
 * at all as one that never started.
 */
export function readSorcererReport(
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
      ...(match[2] === undefined ? {} : { line: Number(match[2]) }),
    };
  }
  for (const row of rows) {
    const match = BREAK_LINE.exec(row);
    if (!match) continue;
    return {
      isError: false,
      message: match[0].trim(),
      ...(match[1] === undefined ? {} : { line: Number(match[1]) }),
    };
  }
  return isAtReadyPrompt(rows)
    ? { isError: false, message: READY_PROMPT }
    : null;
}

/**
 * True when the last thing on the screen is BASIC's `READY` prompt, i.e.
 * nothing is running.
 *
 * The prompt has to be the last row with anything on it and carry nothing else,
 * so a program that prints the word READY partway through its output does not
 * read as one that has finished. The row holding only the cursor is skipped on
 * the way past, which is the row BASIC leaves the caret on after printing the
 * prompt.
 *
 * That skip is also the one case this gets wrong in the other direction: a
 * program whose last printed line is exactly an underscore is treated as the
 * cursor's row and looked past. Reading the caret's real position instead would
 * settle it, and the Monitor does not publish one - nothing in RAM holds the
 * address of the cell it is drawn in.
 */
export function isAtReadyPrompt(rows: readonly string[]): boolean {
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]!.trim();
    if (row === '' || row === CURSOR) continue;
    return row === READY_PROMPT;
  }
  return false;
}
