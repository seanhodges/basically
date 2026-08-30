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
} from './audio/cassetteEncoder';
import { tokenizeProgram } from './tokenizer';

/**
 * File export targets for the Apple II.
 *
 * Integer BASIC has `SAVE` and `LOAD` in the language, so unlike the Apple I
 * this machine does have a program file of its own - the length-prefixed record
 * `basicImage.ts` describes - and the targets are that file, its audio, and the
 * listing:
 *
 * - **The cassette record** (`.bin`, there being no documented extension) - the
 *   two-byte length and the program text, which is exactly what `SAVE` puts on
 *   tape and what `binaryImports` takes back.
 * - **Cassette audio** (`.wav`) - the same record modulated as the monitor's
 *   `WRITE` routine would have written it, split into the two tape records
 *   `SAVE` makes of it; `audio/cassetteEncoder.ts` derives the timings from the
 *   ROM.
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
export const apple2BuildTargets: BuildTarget[] = [
  fileTarget(
    'apple2-cassette-record',
    'Export cassette record',
    'bin',
    buildCassetteImage,
  ),
  cassetteWavTarget({
    id: 'apple2-wav',
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source) => buildCassetteSamples(source),
  }),
  fileTarget('apple2-listing', 'Export listing (text)', 'bas', buildListing),
];
