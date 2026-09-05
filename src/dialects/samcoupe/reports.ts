import type { MachineReport } from '../types';
import { ERRNR, NMBUFF, PPC, TLBYTE } from './sysvars';

/**
 * SAM BASIC's runtime reports.
 *
 * The ROM prints one as `<number> <message>, <line>:<statement>` - "0 OK, 0:1"
 * at a fresh prompt - and holds the number in `ERRNR` until the next statement
 * clears it. Unlike the Sinclair ROMs this dialect otherwise resembles, the
 * byte is the report number itself rather than the number less one, and the
 * report is numbered rather than lettered.
 *
 * The messages are transcribed from `ERRMVAL` in the ROM's text.asm, where they
 * are stored against a 32-entry table of shared fragments ("Invalid ",
 * " without ", "colour") to save two hundred bytes; the strings below are those
 * expansions. Codes above 55 belong to a disc operating system, which this
 * machine does not load - the ROM maps them through `DOSFLG` to a second table
 * that is not in the ROM at all.
 */
const MESSAGES: Record<number, string> = {
  0: 'OK',
  1: 'Out of memory',
  2: 'not found',
  3: 'DATA has all been read',
  4: 'Subscript wrong',
  5: 'NEXT without FOR',
  6: 'FOR without NEXT',
  7: 'FN without DEF FN',
  8: 'RETURN without GOSUB',
  9: 'Missing LOOP',
  10: 'LOOP without DO',
  11: 'No POP data',
  12: 'Missing DEF PROC',
  13: 'No END PROC',
  14: 'BREAK - CONTINUE to repeat',
  15: 'BREAK into program',
  16: 'STOP statement',
  17: 'STOP in INPUT',
  18: 'Invalid file name',
  19: 'Loading error',
  20: 'Invalid device',
  21: 'Invalid stream number',
  22: 'End of file',
  23: 'Invalid colour',
  24: 'Invalid palette colour',
  25: 'Too many palette changes',
  26: 'Parameter error',
  27: 'Invalid argument',
  28: 'Number too large',
  29: 'Not understood',
  30: 'Integer out of range',
  31: "Statement doesn't exist",
  32: 'Off screen',
  33: 'No room for line',
  34: 'Invalid screen mode',
  35: 'Invalid BLITZ code',
  36: 'Stored area too big',
  37: 'Invalid PUT block',
  38: 'PUT mask mismatch',
  39: 'Missing END IF',
  40: 'Invalid variable name',
  41: 'BASIC stack full',
  42: 'String too long',
  43: 'Invalid screen number',
  44: 'Screen is already open',
  45: 'Stream is already open',
  46: 'Current screen',
  47: 'Stream is not open',
  48: 'Invalid CLEAR address',
  49: 'Invalid Note',
  50: 'Note too long',
  51: 'FPC error',
  52: 'Too many definitions',
  53: 'No DOS',
  54: 'Invalid WINDOW',
  55: 'Missing disk',
};

/**
 * Report 2 is the one the ROM builds a message for rather than printing one:
 * it prints the name of the variable it could not find, then " not found", so
 * the message alone reads as a fragment.
 */
const NOT_FOUND = 2;

/** Clean stops rather than errors: OK, the two BREAKs and the two STOPs. */
const NON_ERROR = new Set([0, 14, 15, 16, 17]);

/** Longest name the report handler can print: the numeric-variable ceiling. */
const MAX_NAME_LENGTH = 32;

interface MemPort {
  read(addr: number): number;
  readWord(addr: number): number;
}

/**
 * The name the "not found" report would print, read out of the buffer the
 * lookup left it in. `TLBYTE`'s low five bits are the length - a true length
 * for a string or array, one less than it for a simple numeric name - and bit 5
 * marks a numeric array. Uppercased for display, as the rest of this dialect's
 * names are; the ROM folds them to lower case on the way in.
 */
function missingName(mem: MemPort): string {
  const tl = mem.read(TLBYTE);
  const numericArray = (tl & 0x20) !== 0;
  const string = (tl & 0x40) !== 0;
  const length = (tl & 0x1f) + (numericArray || string ? 0 : 1);
  if (length < 1 || length > MAX_NAME_LENGTH) return '';
  let name = '';
  for (let i = 0; i < length; i++)
    name += String.fromCharCode(mem.read(NMBUFF + i));
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) return '';
  const suffix = numericArray ? '()' : string ? '$' : '';
  return name.toUpperCase() + suffix;
}

/** Read the machine's last BASIC report from ERRNR, with the line PPC holds. */
export function readSamcoupeReport(mem: MemPort): MachineReport {
  const code = mem.read(ERRNR);
  const line = mem.readWord(PPC);
  let message = MESSAGES[code] ?? `Report ${code}`;
  if (code === NOT_FOUND)
    message = `${missingName(mem) || 'Variable'} ${message}`;
  return {
    isError: !NON_ERROR.has(code),
    message,
    code: String(code),
    // The ROM parks 0xFFFF in PPC while it runs the edit line and prints 0 for
    // a direct command, so neither is a line the user can go to.
    line: line >= 1 && line <= 65279 ? line : undefined,
  };
}

/** The report table, for the crosscheck that reads it back off the ROM. */
export const SAMCOUPE_REPORTS: Readonly<Record<number, string>> = MESSAGES;
