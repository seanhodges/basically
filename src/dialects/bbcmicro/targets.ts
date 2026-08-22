import type { BuildTarget } from '../types';
import {
  buildImageOrThrow,
  cassetteWavTarget,
  fileTarget,
} from '../targetHelpers';
import { tokenizeProgram } from './tokenizer';
import { encodeBbcTape } from './audio/cassetteEncoder';
import { buildBbcDiscImage } from './disc';

export const CASSETTE_SAMPLE_RATE = 44100;

/**
 * Build the loadable tokenized program image. This is exactly the byte layout
 * BBC BASIC keeps from PAGE and that SAVE writes to disc, so it doubles as the
 * export file and as the payload the emulator pokes in at PAGE.
 */
export function buildBbcImage(source: string): Uint8Array {
  // A bare end marker (0x0D 0xFF) means the program is empty.
  return buildImageOrThrow(tokenizeProgram(source), 2);
}

/** Build the cassette audio samples for a program (used by play + wav). */
export function buildCassetteSamples(
  source: string,
  programName: string,
  robust = false,
): Float32Array {
  return encodeBbcTape(buildBbcImage(source), programName, {
    sampleRate: CASSETTE_SAMPLE_RATE,
    leaderMs: robust ? 4000 : 2000,
    interBlockMs: robust ? 2000 : 1000,
  });
}

export const bbcBuildTargets: BuildTarget[] = [
  fileTarget('bbc-file', 'Export tokenized BASIC', 'bbc', buildBbcImage),
  fileTarget(
    'bbc-ssd',
    'Export .ssd disc',
    'ssd',
    (source, { programName, blocks, loader }) =>
      buildBbcDiscImage(source, programName, blocks, loader),
    // A DFS disc image carries the BASIC program plus each memory block as its
    // own file, with load/exec attributes MOS uses to CHAIN BASIC vs *RUN code.
    { supportsBlocks: true },
  ),
  cassetteWavTarget({
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, { programName }) =>
      buildCassetteSamples(source, programName),
  }),
];
