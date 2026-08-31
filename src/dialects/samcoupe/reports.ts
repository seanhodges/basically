import type { MachineReport } from '../types';

/** Decode a SAM BASIC runtime report from the machine's own report state. */
export function decodeSamcoupeReport(
  _code: number,
  _line: number,
): MachineReport {
  throw new Error('samcoupe: not implemented');
}
