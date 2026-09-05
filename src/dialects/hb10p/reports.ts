// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineReport } from '../types';
import {
  ERRFLG,
  ERRLIN,
  OLDLIN,
  OLDTXT,
  type MsxMemPort,
} from '../../emulator/msx/workspace';

/**
 * MSX BASIC error codes and the messages the interpreter prints for them.
 *
 * Read out of the ROM rather than off a reference page: MSX BASIC keeps the
 * messages as consecutive NUL-terminated strings in the BASIC ROM, code 1
 * first, and `reports.test.ts` walks that table in the committed image and
 * fails if a spelling here differs by a character. The gap between 25 and 50 is
 * the interpreter's own - the disc errors are numbered from 50 whether or not a
 * machine has a drive, and this one has none.
 */
export const MSX_ERROR_MESSAGES: Record<number, string> = {
  1: 'NEXT without FOR',
  2: 'Syntax error',
  3: 'RETURN without GOSUB',
  4: 'Out of DATA',
  5: 'Illegal function call',
  6: 'Overflow',
  7: 'Out of memory',
  8: 'Undefined line number',
  9: 'Subscript out of range',
  10: 'Redimensioned array',
  11: 'Division by zero',
  12: 'Illegal direct',
  13: 'Type mismatch',
  14: 'Out of string space',
  15: 'String too long',
  16: 'String formula too complex',
  17: "Can't CONTINUE",
  18: 'Undefined user function',
  19: 'Device I/O error',
  20: 'Verify error',
  21: 'No RESUME',
  22: 'RESUME without error',
  23: 'Unprintable error',
  24: 'Missing operand',
  25: 'Line buffer overflow',
  50: 'FIELD overflow',
  51: 'Internal error',
  52: 'Bad file number',
  53: 'File not found',
  54: 'File already open',
  55: 'Input past end',
  56: 'Bad file name',
  57: 'Direct statement in file',
  58: 'Sequential I/O only',
  59: 'File not OPEN',
};

/** The tokens for the two statements that end a run deliberately. */
const TOK_END = 0x81;
const TOK_STOP = 0x90;

/**
 * The interpreter's current report: Ok, an error message, or Break in nn.
 *
 * The error half is straightforward - ERRFLG holds the code the ERR function
 * returns and ERRLIN the line ERL returns, and RUN clears both - and it is the
 * half the IDE acts on.
 *
 * The break half is not, because **MSX BASIC records where a program stopped
 * but never why**: STOP, END and CTRL-STOP all leave the same OLDLIN/OLDTXT
 * pair for CONT to resume from, and nothing beside them says which happened.
 * So the resume point itself is read. The token immediately before it is the
 * statement that stopped the run, which settles STOP and END outright; a run
 * that simply fell off its last line is told from an interrupted one by what
 * follows the resume point, an end-of-program link rather than another line.
 *
 * The one case that reads as Ok when the machine said Break is a CTRL-STOP
 * landing exactly on the end of the last line, which is a moment wide.
 */
export function readReport(mem: MsxMemPort): MachineReport | null {
  const code = mem.peek(ERRFLG);
  if (code !== 0) {
    return {
      isError: true,
      message: MSX_ERROR_MESSAGES[code] ?? 'Unprintable error',
      code: String(code),
      line: mem.peekWord(ERRLIN),
    };
  }
  const ok: MachineReport = { isError: false, message: 'Ok' };
  const resume = mem.peekWord(OLDTXT);
  if (resume === 0) return ok; // nothing has run, or it cannot be continued
  const stoppedAt = mem.peek((resume - 1) & 0xffff);
  if (stoppedAt !== TOK_STOP) {
    if (stoppedAt === TOK_END) return ok;
    if (mem.peekWord((resume + 1) & 0xffff) === 0) return ok;
  }
  const line = mem.peekWord(OLDLIN);
  return { isError: false, message: `Break in ${line}`, line };
}
