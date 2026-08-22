import type { BuildTarget, MemoryBlock } from '../types';
import {
  buildImageOrThrow,
  cassetteWavTarget,
  fileTarget,
} from '../targetHelpers';
import { tokenizeProgram } from './tokenizer';
import {
  codeTapBlocks,
  tapBlocks,
  tapImageFromBlocks,
  type TapBlock,
} from './tapfile';
import { loaderTapBlocks } from './loader';
import { encodeSpectrumTape } from './audio/cassetteEncoder';

export const CASSETTE_SAMPLE_RATE = 44100;

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
  const programBytes = buildImageOrThrow(tokenizeProgram(source));
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

export const spectrumBuildTargets: BuildTarget[] = [
  fileTarget(
    'tap-file',
    'Export .TAP file',
    'tap',
    (source, { programName, blocks, loader }) =>
      buildTapImage(source, programName, blocks, loader),
    { supportsBlocks: true },
  ),
  cassetteWavTarget({
    sampleRate: CASSETTE_SAMPLE_RATE,
    supportsBlocks: true,
    buildSamples: (source, { programName, blocks, loader }) =>
      buildCassetteSamples(source, programName, false, blocks, loader),
  }),
];
