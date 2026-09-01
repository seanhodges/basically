import type { BuildTarget } from '../types';
import {
  buildImageOrThrow,
  cassetteWavTarget,
  fileTarget,
} from '../targetHelpers';
import { tokenizeProgram } from './tokenizer';
import { samBlocks, samImageFromBlocks, type SamBlock } from './samfile';
import { encodeSamTape } from './audio/cassetteEncoder';

/** Sample rate of the cassette audio this dialect writes. */
export const CASSETTE_SAMPLE_RATE = 44100;

/**
 * The tape as an ordered block list - the one layout shared by the `.tap` file
 * and the cassette audio, so the two exports carry the same bytes.
 *
 * A SAM program tape is the header block and the data block that follows it,
 * exported "load only" (autoStart: null) so it does not silently run itself on
 * real hardware: the user types RUN. (The IDE's emulator drives RUN itself
 * after loading, so Start still auto-runs.)
 */
export function exportTapeBlockList(
  source: string,
  programName: string,
): SamBlock[] {
  const programBytes = buildImageOrThrow(tokenizeProgram(source));
  return samBlocks(programBytes, { name: programName, autoStart: null });
}

/** Build the loadable `.tap` image (see {@link exportTapeBlockList}). */
export function buildTapeImage(source: string, programName = 'program') {
  return samImageFromBlocks(exportTapeBlockList(source, programName));
}

/** Build the cassette audio samples for a program (used by play + wav). */
export function buildCassetteSamples(
  source: string,
  programName: string,
  robust = false,
): Float32Array {
  return encodeSamTape(exportTapeBlockList(source, programName), {
    sampleRate: CASSETTE_SAMPLE_RATE,
    pilotScale: robust ? 2 : 1,
    blockPauseMs: robust ? 2000 : 1000,
  });
}

/**
 * File exports: the tape container and the cassette WAV.
 *
 * Neither carries the document's memory blocks. A SAM CODE file's header names
 * its destination as a page number the ROM adds the saving machine's own LMPR
 * to, and reads back through a page offset the loader keeps in a system
 * variable - so a CODE file's address is only meaningful beside the paging it
 * was written under, which an exported file cannot carry. The IDE's emulator
 * writes a block into the Z80 window directly instead, and the Transfer dialog
 * asks before dropping blocks from an export that cannot hold them.
 */
export const samcoupeBuildTargets: BuildTarget[] = [
  fileTarget('tap-file', 'Export .TAP file', 'tap', (source, { programName }) =>
    buildTapeImage(source, programName),
  ),
  cassetteWavTarget({
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, { programName }) =>
      buildCassetteSamples(source, programName, false),
  }),
];
