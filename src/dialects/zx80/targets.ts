import type { BuildTarget } from '../types';
import { fatalErrors } from '../types';
import { tokenizeProgram } from './tokenizer';
import { buildOFile } from './ofile';
import { encodeCassette } from './audio/cassetteEncoder';
import { samplesToWav } from '../../transfer/wav';

export const CASSETTE_SAMPLE_RATE = 44100;

function buildImageOrThrow(source: string): Uint8Array {
  const { bytes, errors } = tokenizeProgram(source);
  const fatal = fatalErrors(errors);
  if (fatal.length > 0) {
    throw new Error(
      `Program has ${fatal.length} error(s) - fix them before building`,
    );
  }
  if (bytes.length === 0) {
    throw new Error('Program is empty');
  }
  return buildOFile(bytes);
}

/** Build the cassette audio samples for a program (used by play + wav). */
export function buildCassetteSamples(
  source: string,
  _programName: string,
  robust = false,
): Float32Array {
  const image = buildImageOrThrow(source);
  return encodeCassette(image, {
    sampleRate: CASSETTE_SAMPLE_RATE,
    bitGapMicros: robust ? 2600 : 1300,
    leaderSeconds: robust ? 4 : 2,
  });
}

export function buildOImage(source: string): Uint8Array {
  return buildImageOrThrow(source);
}

export const zx80BuildTargets: BuildTarget[] = [
  {
    id: 'o-file',
    label: 'Export .O file',
    fileExtension: 'o',
    build: (source, { programName }) =>
      Promise.resolve([
        {
          fileName: `${programName.toLowerCase()}.o`,
          blob: new Blob([buildImageOrThrow(source) as BlobPart], {
            type: 'application/octet-stream',
          }),
        },
      ]),
  },
  {
    id: 'wav',
    label: 'Export cassette .wav',
    fileExtension: 'wav',
    build: (source, { programName }) =>
      Promise.resolve([
        {
          fileName: `${programName.toLowerCase()}.wav`,
          blob: samplesToWav(
            buildCassetteSamples(source, programName),
            CASSETTE_SAMPLE_RATE,
          ),
        },
      ]),
  },
];
