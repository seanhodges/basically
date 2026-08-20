// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineReport, MachineScreenText } from '../types';

/**
 * BASIC-G's runtime report, read off the dialogue line.
 *
 * A screen scan rather than a workspace read, for the reason the Commodores use
 * one: the interpreter keeps an error *number* while it is handling the error
 * and then returns to its prompt, so by the time anything can look there is
 * nothing left to look at. What survives is the line it printed.
 *
 * The message text is the interpreter's own. Its error table is 10-character
 * fixed-width fields in the shipped image - `Syntax err`, `Dv by zero`,
 * `Type conv.`, `Data exhau` and the rest - and it frames them the same way
 * every time:
 *
 *     + + + Syntax err at line 10 + + +
 *
 * so the frame is what this matches, and the message is whatever it wrapped.
 * Matching the messages themselves would mean restating that table here, and a
 * table restated is a table that drifts.
 *
 * `Stop` uses the same frame and is not an error: it is the program asking to
 * be resumed with CONT, which is exactly what the ZX81's `9 STOP` and the BBC's
 * Escape report are treated as elsewhere.
 */

/** ` + + + <message> at line <n> + + +`, the frame every report is printed in. */
const REPORT = /\+ \+ \+\s+(.+?)(?:\s+at line\s+(\d+))?\s+\+ \+ \+/;

/** What the prompt reads when the last thing that ran did not report anything. */
const READY = 'OK';

/** Reports that are not errors: the program stopped, and CONT would resume it. */
const NOT_AN_ERROR = /^stop\b/i;

/**
 * The report on the dialogue line, or null when the screen cannot be read.
 *
 * The dialogue line is the last of the rows {@link MachineScreenText} carries -
 * the Monitor keeps it below the scrolling text area, and it is where BASIC-G
 * prints both its prompt and its reports.
 */
export function readPmd85Report(
  screen: MachineScreenText | null,
): MachineReport | null {
  if (!screen || screen.lines.length === 0) return null;
  const line = screen.lines[screen.lines.length - 1]!.trim();
  const match = REPORT.exec(line);
  if (!match) {
    return line.startsWith(READY) ? { isError: false, message: READY } : null;
  }
  const message = match[1]!.trim();
  const report: MachineReport = {
    isError: !NOT_AN_ERROR.test(message),
    message,
  };
  if (match[2]) report.line = Number(match[2]);
  return report;
}
