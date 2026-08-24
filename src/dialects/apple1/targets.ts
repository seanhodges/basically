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
} from './audio/aciEncoder';
import { tokenizeProgram } from './tokenizer';

/**
 * File export targets for the Apple I.
 *
 * Integer BASIC has no `LOAD` and no `SAVE`, so there is no native program file
 * to claim an extension for. What the machine has instead is the cassette
 * interface, which writes memory ranges, and the targets follow that:
 *
 * - **The cassette dump** (`.bin`, there being no documented extension) - the
 *   two ranges `4A.FF W` and `800.FFF W` laid end to end, which is exactly the
 *   image `basicImage.ts` builds and the emulator loads. `binaryImports` takes
 *   it back.
 * - **Cassette audio** (`.wav`) - the same two ranges modulated as the ACI card
 *   would have written them; `audio/aciEncoder.ts` derives the timings from its
 *   PROM.
 * - **The listing** (`.bas`) - the program as text. On a machine with no tape
 *   command in BASIC, typing the listing back in is a transfer route rather
 *   than a fallback, and it is the one an Apple I terminal emulator takes.
 *
 * No target carries the document's memory blocks: they live below LOMEM
 * (`$0300-$07FF`, see `memoryBlocks.ts`) and the ranges the cassette interface
 * writes start at `$0800`. Widening the dump would change what the monitor has
 * to be told to read back, so the Transfer dialog's "blocks won't be included"
 * warning is the honest answer here.
 */

/**
 * The listing as plain text: the editor's own source, once it is known to
 * tokenize.
 *
 * Line endings are the host's `\n` rather than the machine's carriage return,
 * because the file is read by a host - this IDE opens it straight back, and a
 * terminal program pasting it into an Apple I converts endings itself.
 */
function buildListing(source: string): Blob {
  assertNoFatalErrors(tokenizeProgram(source).errors);
  if (source.trim() === '') throw new Error('Program is empty');
  return new Blob([source.endsWith('\n') ? source : `${source}\n`], {
    type: 'text/plain',
  });
}

export const apple1BuildTargets: BuildTarget[] = [
  fileTarget(
    'apple1-cassette-dump',
    'Export cassette dump',
    'bin',
    buildCassetteImage,
  ),
  cassetteWavTarget({
    id: 'apple1-wav',
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source) => buildCassetteSamples(source),
  }),
  fileTarget('apple1-listing', 'Export listing (text)', 'bas', buildListing),
];
