import type { BuildTarget } from '../types';
import { tokenizeProgram } from './tokenizer';
import { buildTap, tapBlocks } from './tapfile';
import { encodeSpectrumTape } from '../zxspectrum/audio/cassetteEncoder';
import { samplesToWav } from '../../transfer/wav';

// The .TAP image and cassette codecs are byte-for-byte identical to the 48K
// Spectrum (see docs/dialect-plans/zxspectrum128.md); only the tokenizer differs
// so that PLAY/SPECTRUM programs export correctly. We therefore reuse
// ../zxspectrum/audio's encoder and the shared tapfile, but drive both from the
// 128 tokenizer here rather than re-exporting ../zxspectrum/targets.
export const CASSETTE_SAMPLE_RATE = 44100;

function buildProgramBytes(source: string): Uint8Array {
  const { bytes, errors } = tokenizeProgram(source);
  if (errors.length > 0) {
    throw new Error(
      `Program has ${errors.length} error(s) — fix them before building`,
    );
  }
  if (bytes.length === 0) {
    throw new Error('Program is empty');
  }
  return bytes;
}

/** Build the loadable .TAP image (program + auto-run header). */
export function buildTapImage(
  source: string,
  programName = 'program',
): Uint8Array {
  return buildTap(buildProgramBytes(source), { name: programName });
}

/** Build the cassette audio samples for a program (used by play + wav). */
export function buildCassetteSamples(
  source: string,
  programName: string,
  robust = false,
): Float32Array {
  const blocks = tapBlocks(buildProgramBytes(source), { name: programName });
  return encodeSpectrumTape(blocks, {
    sampleRate: CASSETTE_SAMPLE_RATE,
    pilotScale: robust ? 2 : 1,
    blockPauseMs: robust ? 2000 : 1000,
  });
}

export const spectrum128BuildTargets: BuildTarget[] = [
  {
    id: 'tap-file',
    label: 'Export .TAP file',
    fileExtension: 'tap',
    build: (source, { programName }) =>
      Promise.resolve(
        new Blob([buildTapImage(source, programName) as BlobPart], {
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
