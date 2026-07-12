import type { BuildTarget } from '../types';

/**
 * TODO (pet Stage 1): buildPrg emitting [0x01, 0x04, ...program] ($0401 load
 * address); TODO (pet Stage 4): .prg + cassette .wav build targets.
 * See docs/contributing/dialect-plans/pet.md.
 */
export function buildPrg(_source: string): Uint8Array {
  throw new Error('pet: not implemented (Stage 1)');
}

export const petBuildTargets: BuildTarget[] = [];
