import type { LocoBasicVariant } from './keywords';

/**
 * Locomotive BASIC workspace pointers (program start/end, variable areas,
 * HIMEM, error state, current line), keyed by variant: the BASIC 1.0 and
 * 1.1 workspaces sit at different addresses, so the cpc6128 dialect supplies
 * its own table through the same readers. Stage 5 fills this in.
 */
export interface LocoSysVars {
  /** Address of the BASIC program area start pointer. */
  programStart: number;
  // Stage 5 extends this with the variable-area, HIMEM, error and
  // current-line pointer addresses.
}

export function locoSysVars(_variant: LocoBasicVariant): LocoSysVars {
  throw new Error('cpc464: not implemented');
}
