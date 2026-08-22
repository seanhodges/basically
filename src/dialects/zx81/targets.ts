import type { BuildTarget } from '../types';
import {
  buildImageOrThrow,
  cassetteWavTarget,
  fileTarget,
} from '../targetHelpers';
import { tokenizeProgram } from './tokenizer';
import { buildPFile } from './pfile';
import { encodeCassette } from './audio/cassetteEncoder';

export const CASSETTE_SAMPLE_RATE = 44100;

export function buildPImage(source: string): Uint8Array {
  // Exported images are load-only: NXTLIN is left at the display file so the
  // program does NOT silently auto-run on real hardware (the user types RUN).
  // The IDE emulator builds its own auto-running image via dialect.tokenize().
  return buildPFile(buildImageOrThrow(tokenizeProgram(source)), {
    autoRun: false,
  });
}

/** Build the cassette audio samples for a program (used by play + wav). */
export function buildCassetteSamples(
  source: string,
  programName: string,
  robust = false,
): Float32Array {
  return encodeCassette(programName, buildPImage(source), {
    sampleRate: CASSETTE_SAMPLE_RATE,
    bitGapMicros: robust ? 2600 : 1300,
    leaderSeconds: robust ? 4 : 2,
  });
}

export const zx81BuildTargets: BuildTarget[] = [
  fileTarget('p-file', 'Export .P file', 'p', buildPImage),
  cassetteWavTarget({
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, { programName }) =>
      buildCassetteSamples(source, programName),
  }),
];
