import type { BuildTarget } from '../types';
import { tokenizeProgram } from './tokenizer';
import { encodeBbcTape } from './audio/cassetteEncoder';
import { samplesToWav } from '../../transfer/wav';

export const CASSETTE_SAMPLE_RATE = 44100;

/**
 * Build the loadable tokenized program image. This is exactly the byte layout
 * BBC BASIC keeps from PAGE and that SAVE writes to disc, so it doubles as the
 * export file and as the payload the emulator pokes in at PAGE.
 */
export function buildBbcImage(source: string): Uint8Array {
  const { bytes, errors } = tokenizeProgram(source);
  if (errors.length > 0) {
    throw new Error(
      `Program has ${errors.length} error(s) — fix them before building`,
    );
  }
  // A bare end marker (0x0D 0xFF) means the program is empty.
  if (bytes.length <= 2) {
    throw new Error('Program is empty');
  }
  return bytes;
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
  {
    id: 'bbc-file',
    label: 'Export tokenized BASIC',
    fileExtension: 'bbc',
    build: (source) =>
      Promise.resolve(
        new Blob([buildBbcImage(source) as BlobPart], {
          type: 'application/octet-stream',
        }),
      ),
  },
  {
    id: 'wav',
    label: 'Export cassette .wav',
    fileExtension: 'wav',
    build: (source, { programName }) =>
      Promise.resolve(
        samplesToWav(
          buildCassetteSamples(source, programName),
          CASSETTE_SAMPLE_RATE,
        ),
      ),
  },
];
