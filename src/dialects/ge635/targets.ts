// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { BuildTarget } from '../types';
import { assertNoFatalErrors, fileTarget } from '../targetHelpers';
import { tokenizeProgram } from './tokenizer';

/**
 * File export targets for the GE-635.
 *
 * There is exactly one, because there was exactly one way a program left this
 * machine. The user sat at a Teletype Model 33 ASR, and the ASR is a paper-tape
 * punch and reader: Appendix A gives the whole procedure - "type LISTNH, and
 * turn on the paper tape unit" to punch one, then `NEW`, the file name, `TAPE`
 * and `KEY` to read one back.
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
 * The listing as a paper tape: the bytes the tokenizer punches, which are the
 * canonical record - line number, one space, the trimmed body - each line
 * closed by the CR LF a Teletype needs, with blank editor lines gone and the
 * lines in the order they were typed.
 *
 * **A `{0xNN}` escape resolves to the byte it names**, which is where this
 * parts company with the GE-235's tape. There the escape is written out
 * literally, because the code behind it is a six-bit BCD value no reader of a
 * text file could show and the file would stop being openable. Here the codes
 * are ASCII (section 2.7), so an escape names a byte the punch really wrote
 * and the tape carries it - as the Altair's does. Reading the tape back turns
 * an unprintable code into its escape again, so the round trip is exact either
 * way.
 *
 * `↑` is written as itself, the character the ASR-33's key face carries and
 * this BASIC raises to a power with. It is code 94, where a later ASCII puts
 * `^`, and the tape holds the code rather than the later reading of it.
 *
 * There is nothing to terminate the tape with: ASCII has no end-of-message
 * code, the manual names none, and the end of the file says the same thing.
 */
export function buildPaperTape(source: string): Uint8Array {
  const { image, errors } = tokenizeProgram(source);
  assertNoFatalErrors(errors);
  if (image.length === 0) throw new Error('Program is empty');
  return image;
}

export const ge635BuildTargets: BuildTarget[] = [
  fileTarget(
    'ge635-paper-tape',
    'Export paper tape (ASCII)',
    'txt',
    (source) =>
      new Blob([buildPaperTape(source) as BlobPart], { type: 'text/plain' }),
  ),
];
