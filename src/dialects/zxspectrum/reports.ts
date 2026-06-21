import type { MachineReport } from '../types';
import { sinclairReport } from '../sinclairReports';
import { ERR_NR, PPC } from './sysvars';

/** ZX Spectrum BASIC report codes (codes run 0-9 then A-R). */
const MESSAGES: Record<number, string> = {
  0: 'OK',
  1: 'NEXT without FOR',
  2: 'Variable not found',
  3: 'Subscript wrong',
  4: 'Out of memory',
  5: 'Out of screen',
  6: 'Number too big',
  7: 'RETURN without GOSUB',
  8: 'End of file',
  9: 'STOP statement',
  10: 'Invalid argument',
  11: 'Integer out of range',
  12: 'Nonsense in BASIC',
  13: 'BREAK - CONT repeats',
  14: 'Out of DATA',
  15: 'Invalid file name',
  16: 'No room for line',
  17: 'STOP in INPUT',
  18: 'FOR without NEXT',
  19: 'Invalid I/O device',
  20: 'Invalid colour',
  21: 'BREAK into program',
  22: 'RAMTOP no good',
  23: 'Statement lost',
  24: 'Invalid stream',
  25: 'FN without DEF',
  26: 'Parameter error',
  27: 'Tape loading error',
};

/**
 * Clean stops rather than errors: 0 OK, 9 STOP, D (13) BREAK-CONT, H (17) STOP
 * in INPUT, L (21) BREAK into program.
 */
const NON_ERROR = new Set([0, 9, 13, 17, 21]);

interface MemPort {
  read(addr: number): number;
  readWord(addr: number): number;
}

/** Read the Spectrum's last BASIC report from ERR_NR (0x5C3A) + PPC. */
export function readSpectrumReport(mem: MemPort): MachineReport {
  return sinclairReport(mem.read(ERR_NR), mem.readWord(PPC), {
    messages: MESSAGES,
    nonErrorCodes: NON_ERROR,
  });
}
