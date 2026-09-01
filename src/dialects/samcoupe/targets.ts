import type { BuildTarget } from '../types';

/** File exports: the tape container, the cassette WAV, and the disk image. */
export const samcoupeBuildTargets: BuildTarget[] = [];

/** Sample rate of the cassette audio this dialect writes. */
export const CASSETTE_SAMPLE_RATE = 44100;

/** Tokenized program -> cassette audio at the SAM's 2250 baud. */
export function buildCassetteSamples(
  _source: string,
  _programName: string,
  _robust: boolean,
): Float32Array {
  throw new Error('samcoupe: not implemented');
}
