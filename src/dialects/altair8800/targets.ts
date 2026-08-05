// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { BuildTarget } from '../types';
import { fatalErrors } from '../types';
import { altair8800Charset } from './charset';
import {
  CASSETTE_SAMPLE_RATE,
  buildCassetteSamples,
  buildCsaveImage,
} from './audio/cassetteEncoder';
import { tokenizeProgram } from './tokenizer';
import { samplesToWav } from '../../transfer/wav';

/**
 * File export targets for the Altair.
 *
 * The machine had no single program container, so the targets follow what the
 * hardware actually offered rather than inventing an `.altair` format:
 *
 * - **The `CSAVE` image** (`.bin`) - the tokenized program with the four-byte
 *   header `CSAVE` wrote in front of it. See `csaveFile.ts` for the layout and
 *   how it was read off the running interpreter. This is the closest thing the
 *   machine has to a native program file, and a raw byte stream is what Altair
 *   simulators feed to a virtual 88-ACR.
 * - **Cassette audio** (`.wav`) - the same bytes modulated as the 88-ACR's
 *   300-baud FSK. Note that the board is *not* a Kansas City Standard modem,
 *   whatever its 2400 Hz mark tone suggests; `audio/cassetteEncoder.ts` has the
 *   derivation.
 * - **Paper tape** (`.txt`) - the listing in plain ASCII, which is how a
 *   program left a machine with no cassette board at all: `LIST` with the
 *   Teletype's punch running, and BASIC re-reads it line by line on the way
 *   back in.
 *
 * Import is the mirror: `binaryImports` offers the `CSAVE` image back (the
 * header is optional there - a bare program image reads too),
 * `audio.decodeSamples` recovers a program from recorded cassette audio, and a
 * paper tape is text, so it opens through the ordinary `.txt` file path.
 *
 * No target carries memory blocks, because `CSAVE` wrote the program area and
 * nothing else; the Transfer dialog already warns when a document's blocks
 * would be dropped.
 */

/** Fatal tokenizer errors, phrased the way every export path here reports them. */
function assertBuildable(source: string): void {
  const fatal = fatalErrors(tokenizeProgram(source).errors);
  if (fatal.length > 0) {
    throw new Error(
      `Program has ${fatal.length} error(s) - fix them before building`,
    );
  }
}

/**
 * The listing as a paper tape: the program's own bytes, CR LF between lines.
 *
 * A byte-level export rather than the editor's text save. `{0xNN}` escapes
 * become the raw bytes they name, so a string holding a control code punches
 * that code, and the line ending is the CR LF a Teletype needs rather than the
 * editor's bare LF.
 *
 * A real punch would also interleave null bytes after each CR LF - that is what
 * BASIC's `NULL` command sets, giving the reader's carriage time to return.
 * They are deliberately not written: BASIC ignores nulls on the way back in,
 * and leaving them out keeps the file a plain readable listing.
 */
export function buildPaperTape(source: string): Uint8Array {
  assertBuildable(source);
  const lines = source.split('\n');
  // A trailing newline in the editor is one empty final line, not a blank line
  // to punch.
  if (lines[lines.length - 1] === '') lines.pop();
  if (lines.length === 0) throw new Error('Program is empty');
  const out: number[] = [];
  for (const line of lines) {
    for (const b of altair8800Charset.toMachine(line)) out.push(b);
    out.push(0x0d, 0x0a);
  }
  return Uint8Array.from(out);
}

export const altair8800BuildTargets: BuildTarget[] = [
  {
    id: 'altair-csave',
    label: 'Export CSAVE image',
    fileExtension: 'bin',
    build: (source, { programName }) =>
      Promise.resolve([
        {
          fileName: `${programName.toLowerCase()}.bin`,
          blob: new Blob([buildCsaveImage(source, programName) as BlobPart], {
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
            buildCassetteSamples(source, programName, false),
            CASSETTE_SAMPLE_RATE,
          ),
        },
      ]),
  },
  {
    id: 'altair-paper-tape',
    label: 'Export paper tape (ASCII)',
    fileExtension: 'txt',
    build: (source, { programName }) =>
      Promise.resolve([
        {
          fileName: `${programName.toLowerCase()}.txt`,
          blob: new Blob([buildPaperTape(source) as BlobPart], {
            type: 'text/plain',
          }),
        },
      ]),
  },
];
