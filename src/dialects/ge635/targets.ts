// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { BuildTarget } from '../types';
import { fileTarget, paperTapeListing } from '../targetHelpers';
import { detokenizeProgram } from './detokenizer';
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
 * needs no `binaryImports` entry - the same arrangement the GE-235's and the
 * Altair's paper tapes have. There is no `audio` member anywhere in this
 * dialect for the same reason the Ataris have none: the machine had no tape
 * interface to model.
 *
 * No target carries memory blocks, because the dialect has none - this machine
 * is offered as BASIC only.
 */

/**
 * The listing as a paper tape, built by the same {@link paperTapeListing} the
 * GE-235 uses - the two machines punch the same shape of file, and the helper
 * carries why it is the listing rather than the machine's own codes.
 *
 * The one thing worth saying here is what that costs *this* machine, because it
 * is the machine that had the choice. Its codes are ASCII (section 2.7), so a
 * `{0xNN}` escape names a byte the punch really could have written - but a
 * `.txt` is read back as text, and an ASCII control code is not a character the
 * charset can encode, so the more faithful artifact would be a file that could
 * not be opened again. The GE-235 never had the choice: a 6-bit BCD code has no
 * text form at all. So both spell their escapes out, and this one gives up a
 * fidelity it could have had.
 *
 * `↑` is written as itself, the character the ASR-33's key face carries and
 * this BASIC raises to a power with. On the tape it is code 94, where a later
 * ASCII puts `^`; on the file it is the arrow, which is the character the
 * editor reads and the only one of the two this charset can encode.
 */
export function buildPaperTape(source: string): Uint8Array {
  return paperTapeListing(tokenizeProgram(source), detokenizeProgram);
}

export const ge635BuildTargets: BuildTarget[] = [
  fileTarget(
    'ge635-paper-tape',
    'Export paper tape (text)',
    'txt',
    (source) =>
      new Blob([buildPaperTape(source) as BlobPart], { type: 'text/plain' }),
  ),
];
