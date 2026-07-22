import type { MachineReport } from '../types';
import type { LocoSysVars } from './sysvars';

/**
 * The BASIC runtime report (ERR/ERL error state) read from a running CPC,
 * for the IDE's post-run error check. Stage 5 fills this in.
 */
export function readLocoReport(
  _read: (addr: number) => number,
  _sysvars: LocoSysVars,
): MachineReport | null {
  throw new Error('cpc464: not implemented');
}
