// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineReport } from '../types';

/**
 * Recover the BASIC runtime report - an error, or OK - after a run (Stage 5),
 * behind the machine's `readReport()`, so the IDE can notice a program that
 * stopped on an error and offer a fix.
 *
 * Every other machine here reads this from somewhere structured: a report-code
 * system variable on the Sinclair ROMs, the MOS error block on the BBC. The
 * Altair has neither. Its errors are *printed* - `?SN ERROR IN 100`, and the
 * terse two-letter codes 8K BASIC uses - so the only reliable source is the
 * terminal output itself, which makes this closest to the Commodore screen-scan
 * approach in `src/emulator/c64/reports.ts`.
 *
 * Scan the terminal grid rather than the serial stream, so a report stays
 * readable after the program has scrolled on, and return null when nothing
 * matches: a false "OK" is worse than no report at all.
 */
export function readReport(_terminalCells: Uint8Array): MachineReport | null {
  throw new Error('altair8800: not implemented');
}
