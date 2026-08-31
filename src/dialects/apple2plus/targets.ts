// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { BuildTarget } from '../types';
import {
  assertNoFatalErrors,
  cassetteWavTarget,
  fileTarget,
} from '../targetHelpers';
import {
  CASSETTE_SAMPLE_RATE,
  buildCassetteImage,
  buildCassetteSamples,
} from './audio/cassette';
import { tokenizeProgram } from './tokenizer';

/**
 * File export targets for the Apple II Plus.
 *
 * Applesoft has `SAVE` and `LOAD` in the language, so the machine has a program
 * file of its own and the targets are that file, its audio, and the listing:
 *
 * - **The cassette record** (`.bin`, there being no documented extension) - the
 *   program exactly as it sits at `$0801`, which is what `SAVE`'s program
 *   record carries and what `binaryImports` takes back. Unlike the sibling's
 *   there is no header in the file: Applesoft's linked list describes itself,
 *   so the load format is the file format and `detokenize` reads it directly.
 *   The length the tape declares is derived from those bytes rather than stored
 *   beside them, which is why a file and a tape cannot disagree here.
 * - **Cassette audio** (`.wav`) - the same program behind the two records
 *   `SAVE` writes, modulated as the monitor's `WRITE` would have written them;
 *   `audio/cassette.ts` derives the framing from the ROM and the modulation
 *   from the sibling, which calls the same routine.
 * - **The listing** (`.bas`) - the program as text, which is how a program
 *   moves between this IDE and anything that is not an Apple II.
 *
 * No target carries the document's memory blocks. `SAVE` writes the program
 * workspace and nothing else, and the block window is page 3 (see
 * `memoryBlocks.ts`), so widening the file would make something the machine
 * could not read back - the Transfer dialog's "blocks won't be included"
 * warning is the honest answer here.
 */

/**
 * The listing as plain text: the editor's own source, once it is known to
 * tokenize.
 *
 * Line endings are the host's `\n` rather than the machine's carriage return,
 * because the file is read by a host - this IDE opens it straight back, and a
 * terminal program typing it into an Apple II converts endings itself.
 */
function buildListing(source: string): Blob {
  assertNoFatalErrors(tokenizeProgram(source).errors);
  if (source.trim() === '') throw new Error('Program is empty');
  return new Blob([source.endsWith('\n') ? source : `${source}\n`], {
    type: 'text/plain',
  });
}

/** File exports: the cassette record, its modulated audio, and the listing. */
export const apple2plusBuildTargets: BuildTarget[] = [
  fileTarget(
    'apple2plus-cassette-record',
    'Export cassette record',
    'bin',
    buildCassetteImage,
  ),
  cassetteWavTarget({
    id: 'apple2plus-wav',
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source) => buildCassetteSamples(source),
  }),
  fileTarget(
    'apple2plus-listing',
    'Export listing (text)',
    'bas',
    buildListing,
  ),
];
