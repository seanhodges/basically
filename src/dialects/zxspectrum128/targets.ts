import type { BuildTarget, MemoryBlock } from '../types';
import { fatalErrors } from '../types';
import { tokenizeProgram } from './tokenizer';
import {
  codeTapBlocks,
  tapBlocks,
  tapImageFromBlocks,
  type TapBlock,
} from './tapfile';
import { loaderTapBlocks } from '../zxspectrum/loader';
import { encodeSpectrumTape } from '../zxspectrum/audio/cassetteEncoder';
import { samplesToWav } from '../../transfer/wav';

// The .TAP image and cassette codecs are byte-for-byte identical to the 48K
// Spectrum; only the tokenizer differs, so that PLAY/SPECTRUM programs export
// correctly. ../zxspectrum/audio's encoder and the shared tapfile are therefore
// reused, but both are driven from the 128 tokenizer here rather than
// re-exporting ../zxspectrum/targets.
//
// For the same reason the block and loader tape layout below deliberately
// mirrors the 48K's exportTapBlockList: same file order, same CODE encoding,
// same generated loader (its BASIC is core Sinclair, so both tokenizers emit
// identical bytes for it). blockExportRoundTrip.test.ts asserts the two
// machines produce the same tape shape and is what holds them in step.
export const CASSETTE_SAMPLE_RATE = 44100;

function buildProgramBytes(source: string): Uint8Array {
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
  return bytes;
}

/**
 * The full tape as an ordered {@link TapBlock} list - the single layout
 * shared by the `.TAP` file and the cassette-audio encoding.
 *
 * Without memory blocks it is the classic single program, exported "load
 * only" (autoStart: null) so it does NOT silently auto-run on a real
 * Spectrum - the user types RUN. (The IDE emulator drives RUN itself after
 * loading, so Start still auto-runs.)
 *
 * With memory blocks the tape becomes multi-file: each block is a CODE file
 * (in address order). With `loader` a generated auto-run loader BASIC leads
 * the tape (CLEAR, LOAD ""CODE per block, LOAD "") and the main program sits
 * last, auto-starting at its first line, so `LOAD ""` runs the whole thing;
 * without it the load-only main program comes first and the CODE files
 * follow, for users whose program does its own loading.
 */
export function exportTapBlockList(
  source: string,
  programName: string,
  memoryBlocks: readonly MemoryBlock[] = [],
  loader = false,
): TapBlock[] {
  const programBytes = buildProgramBytes(source);
  if (memoryBlocks.length === 0) {
    return tapBlocks(programBytes, { name: programName, autoStart: null });
  }
  const sorted = [...memoryBlocks].sort((a, b) => a.address - b.address);
  const codeBlocks = sorted.flatMap((b) =>
    codeTapBlocks(b.name, b.address, b.bytes),
  );
  if (loader) {
    return [
      ...loaderTapBlocks(programName, sorted),
      ...codeBlocks,
      // The loader's final LOAD "" chains here; the auto-start header (the
      // program's first line, tapBlocks' default) makes it run on load.
      ...tapBlocks(programBytes, { name: programName }),
    ];
  }
  return [
    ...tapBlocks(programBytes, { name: programName, autoStart: null }),
    ...codeBlocks,
  ];
}

/**
 * Build the loadable .TAP image (see {@link exportTapBlockList} for the tape
 * layout, block and loader semantics).
 */
export function buildTapImage(
  source: string,
  programName = 'program',
  memoryBlocks: readonly MemoryBlock[] = [],
  loader = false,
): Uint8Array {
  return tapImageFromBlocks(
    exportTapBlockList(source, programName, memoryBlocks, loader),
  );
}

/** Build the cassette audio samples for a program (used by play + wav). */
export function buildCassetteSamples(
  source: string,
  programName: string,
  robust = false,
  memoryBlocks: readonly MemoryBlock[] = [],
  loader = false,
): Float32Array {
  const blocks = exportTapBlockList(source, programName, memoryBlocks, loader);
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
    supportsBlocks: true,
    build: (source, { programName, blocks, loader }) =>
      Promise.resolve([
        {
          fileName: `${programName.toLowerCase()}.tap`,
          blob: new Blob(
            [buildTapImage(source, programName, blocks, loader) as BlobPart],
            { type: 'application/octet-stream' },
          ),
        },
      ]),
  },
  {
    id: 'wav',
    label: 'Export cassette .wav',
    fileExtension: 'wav',
    supportsBlocks: true,
    build: (source, { programName, blocks, loader }) =>
      Promise.resolve([
        {
          fileName: `${programName.toLowerCase()}.wav`,
          blob: samplesToWav(
            buildCassetteSamples(source, programName, false, blocks, loader),
            CASSETTE_SAMPLE_RATE,
          ),
        },
      ]),
  },
];
