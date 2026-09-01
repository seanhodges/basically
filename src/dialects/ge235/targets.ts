// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { BuildTarget } from '../types';
import { assertNoFatalErrors, fileTarget } from '../targetHelpers';
import { detokenizeProgram } from './detokenizer';
import { tokenizeProgram } from './tokenizer';

/**
 * File export targets for the GE-235.
 *
 * There is exactly one, because there was exactly one way a program left this
 * machine. It had no cassette deck, no disc and no serial port; what the user
 * sat at was a Teletype Model 33 ASR, and the ASR is a paper-tape punch and
 * reader. `LIST` with the punch running produced the tape, and the reader fed
 * it back a line at a time.
 *
 * The tape is text, so it opens straight back through `fileExtensions` and
 * needs no `binaryImports` entry - the same arrangement the Altair's paper tape
 * has. There is no `audio` member anywhere in this dialect for the same reason
 * the Ataris have none: the machine had no tape interface to model.
 *
 * No target carries memory blocks, because the dialect has none - this machine
 * is offered as BASIC only.
 */

/**
 * The listing as a paper tape: the line records the tape carries, each closed
 * by the CR LF a Teletype needs.
 *
 * The text comes back off the tokenized image rather than out of the editor, so
 * what is written is what the tape holds - the canonical record the tokenizer
 * punches (line number, one space, the trimmed body), with blank editor lines
 * gone and the lines in the order they were typed.
 *
 * Two things the Altair's paper tape does are deliberately not done here, and
 * both follow from this machine's codes not being ASCII:
 *
 *  - **`{0oNN}` escapes stay spelled out.** On the Altair an escape resolves to
 *    the byte it names, because there that byte *is* the ASCII the punch wrote.
 *    Here it would be a 6-bit BCD code no reader of a text file could show, and
 *    the file would stop being openable. Spelled out, it survives the round
 *    trip.
 *  - **The end-of-message code does not close the file.** It is the reader's
 *    terminator, 0o55, and it has no printable form; the end of the file says
 *    the same thing.
 *
 * `↑` is written as itself. It is this BASIC's power operator and the ASR-33's
 * own keycap, and the 1967 revision of ASCII that spells it `^` is two years
 * later than the machine - so the tape carries the character the machine had,
 * which is also the one the editor reads back.
 */
export function buildPaperTape(source: string): Uint8Array {
  const { image, errors } = tokenizeProgram(source);
  assertNoFatalErrors(errors);
  const listing = detokenizeProgram(image);
  if (listing === '') throw new Error('Program is empty');
  return new TextEncoder().encode(
    listing
      .split('\n')
      .map((line) => `${line}\r\n`)
      .join(''),
  );
}

export const ge235BuildTargets: BuildTarget[] = [
  fileTarget(
    'ge235-paper-tape',
    'Export paper tape (text)',
    'txt',
    (source) =>
      new Blob([buildPaperTape(source) as BlobPart], { type: 'text/plain' }),
  ),
];
