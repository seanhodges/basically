import type { MachineVariable } from '../types';

/** Walk SAM BASIC's variable area for the watcher. */
export function readSamcoupeVariables(
  _read: (addr: number) => number,
): MachineVariable[] {
  throw new Error('samcoupe: not implemented');
}
