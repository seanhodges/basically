import type { MachineVariable } from '../types';
import type { LocoSysVars } from './sysvars';

/**
 * Walk Locomotive BASIC's variable storage (integer %, real !/unsuffixed,
 * string $, arrays) via the variant's system pointers, for the variable
 * watcher's `readVariables()`. Stage 5 fills this in.
 */
export function readLocoVariables(
  _read: (addr: number) => number,
  _sysvars: LocoSysVars,
): MachineVariable[] {
  throw new Error('cpc464: not implemented');
}
