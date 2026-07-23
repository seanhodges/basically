import type { MachineReport } from '../types';
import type { LocoSysVars } from './sysvars';
import type { LocoMemPort } from './vars';

/**
 * Locomotive BASIC error numbers → messages (as printed by the firmware). The
 * numbers are the values the ROM leaves in the ERR system variable and that the
 * `ERR` function returns. `0` means "no error"; every other code stopped the
 * program with the matching `... in <line>` report.
 */
const MESSAGES: Record<number, string> = {
  1: 'Unexpected NEXT',
  2: 'Syntax Error',
  3: 'Unexpected RETURN',
  4: 'DATA exhausted',
  5: 'Improper argument',
  6: 'Overflow',
  7: 'Memory full',
  8: 'Line does not exist',
  9: 'Subscript out of range',
  10: 'Array already dimensioned',
  11: 'Division by zero',
  12: 'Invalid direct command',
  13: 'Type mismatch',
  14: 'String space full',
  15: 'String too long',
  16: 'String expression too complex',
  17: 'Cannot CONTinue',
  18: 'Unknown user function',
  19: 'RESUME missing',
  20: 'Unexpected RESUME',
  21: 'Direct command found',
  22: 'Operand missing',
  23: 'Line too long',
  24: 'EOF met',
  25: 'File type error',
  26: 'NEXT missing',
  27: 'File already open',
  28: 'Unknown command',
  29: 'WEND missing',
  30: 'Unexpected WEND',
  31: 'File not open',
  32: 'Broken',
};

/**
 * Read the CPC's last BASIC report from the ERR/ERL system variables. `ERR`
 * (a byte) is 0 while a program runs cleanly and holds the error number after a
 * trapped runtime error; `ERL` (a word) is the line it happened on. A clean run
 * therefore reports `isError: false` and the IDE skips its post-run error
 * prompt, exactly as the Sinclair/BBC readers do.
 *
 * Note the arithmetic warnings the firmware prints without a line number
 * ("Division by zero", "Overflow") do not set ERR - Locomotive substitutes a
 * limiting value and carries on - so they read back as OK, which matches the
 * machine's own behaviour.
 */
export function readLocoReport(
  mem: LocoMemPort,
  sysvars: LocoSysVars,
): MachineReport {
  const code = mem.read(sysvars.errCode);
  if (code === 0) {
    return { isError: false, message: 'OK' };
  }
  return {
    isError: true,
    message: MESSAGES[code] ?? 'Unknown error',
    code: String(code),
    line: mem.readWord(sysvars.errLine),
  };
}
