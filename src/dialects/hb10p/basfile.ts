// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { DetokenizeResult } from '../types';
import { buildImageOrThrow } from '../targetHelpers';
import { hb10pCharset } from './charset';
import { detokenizeProgram } from './detokenizer';
import { tokenizeProgram } from './tokenizer';

/**
 * The MSX `.bas` container: a 0xFF marker byte followed by the tokenized
 * program exactly as it sits in memory from TXTTAB. A file starting with any
 * other byte is an ASCII listing, which MSX BASIC loads by a different route -
 * `SAVE"name",A` writes one and the machine re-tokenizes it line by line.
 */
export const BAS_TOKENIZED_MARKER = 0xff;

/**
 * The program area `SAVE` and `CSAVE` both write: everything between TXTTAB and
 * VARTAB. Throws rather than exporting a program the machine could not load.
 */
export function buildTokenizedProgram(source: string): Uint8Array {
  const { bytes, errors } = tokenizeProgram(source);
  // A program with no lines is the bare 0x0000 end link and nothing else.
  return buildImageOrThrow({ bytes, errors }, 2);
}

/** Wrap tokenized program bytes as a loadable `.bas` image. */
export function buildBasFile(programBytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(programBytes.length + 1);
  out[0] = BAS_TOKENIZED_MARKER;
  out.set(programBytes, 1);
  return out;
}

/** Read a `.bas` image back, relinking the lines to the program base. */
export function importBasFile(image: Uint8Array): DetokenizeResult {
  if (image.length === 0) return { source: '', warnings: [] };
  if (image[0] === BAS_TOKENIZED_MARKER) {
    return detokenizeProgram(image.subarray(1));
  }
  return readAsciiListing(image);
}

/**
 * An ASCII listing - what `SAVE"name",A` writes, on disk or on tape - back to
 * editor text.
 *
 * The text is already the program, so it is read through the charset rather
 * than through the token decoder, which would make nonsense of every byte above
 * 0x7F. A trailing 0x1A is the end-of-file mark MSX BASIC writes, not program
 * text.
 */
export function readAsciiListing(bytes: Uint8Array): DetokenizeResult {
  const marked = bytes.indexOf(0x1a);
  const body = marked === -1 ? bytes : bytes.subarray(0, marked);
  // Split on the line breaks before decoding: a bare 0x0A or 0x0D has no
  // character of its own in this charset and would come back as an escape.
  const lines: string[] = [];
  let start = 0;
  for (let i = 0; i <= body.length; i++) {
    if (i === body.length || body[i] === 0x0a || body[i] === 0x0d) {
      lines.push(hb10pCharset.toUnicode(body.subarray(start, i)));
      if (body[i] === 0x0d && body[i + 1] === 0x0a) i++;
      start = i + 1;
    }
  }
  return {
    source: lines.join('\n').trimEnd(),
    warnings: [
      'The file is an ASCII listing rather than a tokenized program, so it has been read as text.',
    ],
  };
}
