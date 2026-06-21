import type { MachineReport } from '../types';
import { sinclairReport } from '../sinclairReports';
import { ERR_NR, OLDPPC } from './sysvars';

/** ZX81 BASIC report codes (manual, Appendix B). */
const MESSAGES: Record<number, string> = {
  0: 'OK',
  1: 'NEXT without a matching FOR (control variable not found)',
  2: 'Undefined variable',
  3: 'Subscript out of range',
  4: 'Out of memory',
  5: 'Screen full (no room to print)',
  6: 'Number too big (arithmetic overflow)',
  7: 'RETURN without GOSUB',
  8: 'End of INPUT / cannot continue',
  9: 'STOP statement executed',
  10: 'Invalid argument to a function',
  11: 'Integer out of range',
  12: 'Nonsense input',
  13: 'BREAK pressed',
  15: 'Bad program/file name',
};

/** Codes that are a clean stop, not an error: 0 OK, 9 STOP, 13 (D) BREAK. */
const NON_ERROR = new Set([0, 9, 13]);

interface MemPort {
  read(addr: number): number;
  readWord(addr: number): number;
}

/** Read the ZX81's last BASIC report from ERR_NR (0x4000) + OLDPPC. */
export function readZx81Report(mem: MemPort): MachineReport {
  return sinclairReport(mem.read(ERR_NR), mem.readWord(OLDPPC), {
    messages: MESSAGES,
    nonErrorCodes: NON_ERROR,
  });
}
