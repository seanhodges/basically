import type { BuildTarget } from '../types';
import {
  buildImageOrThrow,
  cassetteWavTarget,
  fileTarget,
} from '../targetHelpers';
import { tokenizeProgram } from './tokenizer';
import { buildOFile } from './ofile';
import { encodeCassette } from './audio/cassetteEncoder';

export const CASSETTE_SAMPLE_RATE = 44100;

export function buildOImage(source: string): Uint8Array {
  return buildOFile(buildImageOrThrow(tokenizeProgram(source)));
}

/** Build the cassette audio samples for a program (used by play + wav). */
export function buildCassetteSamples(
  source: string,
  _programName: string,
  robust = false,
): Float32Array {
  return encodeCassette(buildOImage(source), {
    sampleRate: CASSETTE_SAMPLE_RATE,
    bitGapMicros: robust ? 2600 : 1300,
    leaderSeconds: robust ? 4 : 2,
  });
}

export const zx80BuildTargets: BuildTarget[] = [
  fileTarget('o-file', 'Export .O file', 'o', buildOImage),
  cassetteWavTarget({
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, { programName }) =>
      buildCassetteSamples(source, programName),
  }),
];
