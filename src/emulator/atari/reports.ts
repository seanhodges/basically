// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineReport, MachineScreenText } from '../../dialects/types';
import { BASIC_REPORT_CELLS } from '../../dialects/atari800/addresses';

/**
 * Atari BASIC's runtime report: the code from BASIC's own cells, and whether it
 * stopped the program from what it printed.
 *
 * The cartridge prints a number rather than a message - `Error-   11 at line
 * 20` - so the text below is the manual's, not the ROM's. What the ROM does own
 * is the code, which it leaves in `ERRSAV` with the line in `STOPLN`.
 *
 * ### Why the screen is consulted at all
 *
 * `ERRSAV` says what last went wrong, not that the program stopped for it. A
 * `TRAP`ped error leaves both cells exactly as an untrapped one does and then
 * carries on to a normal end - that is the whole point of TRAP, and a program
 * is expected to `PEEK` them afterwards to find out what it caught. The one
 * thing only an untrapped error does is print, so the printed line is what
 * separates the two.
 *
 * That makes this a screen scan like the Commodore and PMD 85 readers, but a
 * cheaper one: the cells are read first, and a run that neither failed nor
 * stopped never touches the screen at all.
 *
 * A cartridge that spelled its reports differently would read as a clean end
 * here. The trade is deliberate - a wrong "no error" costs less than calling
 * every TRAPped program broken - and the machine ships with one cartridge.
 */

/** `Error-   11 at line 20`, with the code and the line. */
const ERROR_LINE = /\berror-\s*(\d+)\s+at line\s+(\d+)/i;

/** `Stopped at line 20`, which STOP and the BREAK key both print. */
const STOP_LINE = /\bstopped at line\s+(\d+)/i;

/** What a run that neither failed nor stopped reports. */
const READY = 'OK';

/**
 * Atari BASIC's own error codes, from the *Atari BASIC Reference Manual*'s
 * error appendix.
 *
 * One of these is the cartridge's rather than the manual's: reading past the
 * end of `DATA` answers 8 here, where the manual documents 6 for it. Both are
 * listed, and `introspection.test.ts` pins what the cartridge actually does.
 */
const BASIC_ERRORS: Record<number, string> = {
  2: 'Memory insufficient',
  3: 'Value error',
  4: 'Too many variables',
  5: 'String length error',
  6: 'Out of data',
  7: 'Number greater than 32767',
  8: 'INPUT statement error',
  9: 'Array or string DIM error',
  10: 'Argument stack overflow',
  11: 'Floating point overflow or underflow',
  12: 'Line not found',
  13: 'No matching FOR statement',
  14: 'Line too long',
  15: 'GOSUB or FOR line deleted',
  16: 'RETURN without GOSUB',
  17: 'Garbage error',
  18: 'Invalid string character',
  19: 'LOAD program too long',
  20: 'Device number error',
  21: 'LOAD file error',
};

/**
 * The operating system's codes, which reach BASIC through the same cell when a
 * device call fails: an `OPEN` of a device that is not there, a `GET` past the
 * end of a file, a cassette the recorder never answered for.
 */
const DEVICE_ERRORS: Record<number, string> = {
  128: 'BREAK abort',
  129: 'IOCB already open',
  130: 'Nonexistent device',
  131: 'IOCB opened for write only',
  132: 'Invalid command',
  133: 'Device or file not open',
  134: 'Bad IOCB number',
  135: 'IOCB opened for read only',
  136: 'End of file',
  137: 'Truncated record',
  138: 'Device timeout',
  139: 'Device NAK',
  140: 'Serial bus error',
  141: 'Cursor out of range',
  142: 'Serial bus data frame overrun',
  143: 'Serial bus data frame checksum error',
  144: 'Device done error',
  145: 'Read after write compare error, or bad screen mode',
  146: 'Function not implemented',
  147: 'Insufficient RAM',
  160: 'Drive number error',
  161: 'Too many open files',
  162: 'Disk full',
  163: 'Unrecoverable system data I/O error',
  164: 'File number mismatch',
  165: 'File name error',
  166: 'POINT data length error',
  167: 'File locked',
  168: 'Command invalid',
  169: 'Directory full',
  170: 'File not found',
  171: 'POINT invalid',
};

/** The message for a code, or the bare number where neither table names it. */
export function atariErrorMessage(code: number): string {
  return BASIC_ERRORS[code] ?? DEVICE_ERRORS[code] ?? `Error ${code}`;
}

/** The two cells this reads; the machine hands over its raw RAM. */
export interface AtariReportPort {
  read(address: number): number;
  readWord(address: number): number;
}

/**
 * The report from the last thing BASIC ran, or null when the editor screen
 * cannot be read - a full-screen graphics mode with no text window, where
 * whatever BASIC printed went nowhere the machine can read it back from.
 *
 * `editor` is the window BASIC prints into, which is the whole screen in
 * GRAPHICS 0 and the four rows at the foot in every mode that leaves one.
 */
export function readAtariReport(
  mem: AtariReportPort,
  editor: MachineScreenText | null,
): MachineReport | null {
  const { ERRSAV, STOPLN } = BASIC_REPORT_CELLS;
  const code = mem.read(ERRSAV);
  const stoppedAt = mem.readWord(STOPLN);
  // Nothing has gone wrong and nothing has stopped since power-on, so there is
  // no line to look for.
  if (code === 0 && stoppedAt === 0) return { isError: false, message: READY };
  if (!editor) return null;

  const text = editor.lines.join('\n');
  const failed = ERROR_LINE.exec(text);
  if (failed) {
    const printed = Number(failed[1]);
    return {
      isError: true,
      message: atariErrorMessage(printed),
      code: String(printed),
      line: Number(failed[2]),
    };
  }
  const stopped = STOP_LINE.exec(text);
  if (stopped) {
    return { isError: false, message: 'Stopped', line: Number(stopped[1]) };
  }
  return { isError: false, message: READY };
}
