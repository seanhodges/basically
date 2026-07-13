import type { BuildTarget } from '../types';

/**
 * TODO (vic20 Stage 1): buildPrg emitting [0x01, 0x10, ...program] ($1001
 * load address, unexpanded machine); TODO (vic20 Stage 4): .prg + cassette
 * .wav build targets. See docs/contributing/dialect-plans/vic20.md.
 */
export function buildPrg(_source: string): Uint8Array {
  throw new Error('vic20: not implemented (Stage 1)');
}

export const vic20BuildTargets: BuildTarget[] = [];
