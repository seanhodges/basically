// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CR, EOM, ge235Charset } from './charset';

/**
 * GE-235 paper tape -> editor text: the inverse of `tokenizer.ts`, and the half
 * that has to be *total* from the start.
 *
 * The image is a run of BCD codes with a carriage return after each line and an
 * end-of-message code closing the tape. Every code the Teletype cannot print
 * gets a `{0oNN}` escape rather than a lossy `?`, so nothing is silently lost
 * and re-encoding the text reproduces the tape byte for byte.
 *
 * Two things are dropped, and both are malformed rather than lossy: anything
 * past the end-of-message code, which the compiler would never have read, and a
 * record carrying no line - a bare carriage return, or one holding only spaces.
 * The tokenizer never punches either, and the compiler answers an empty line
 * with "illegal instruction", so there is no program text to lose.
 */
export function detokenizeProgram(image: Uint8Array): string {
  const lines: string[] = [];
  let record: number[] = [];

  const flush = (): void => {
    const text = ge235Charset.toUnicode(record);
    if (text.trim() !== '') lines.push(text);
    record = [];
  };

  for (const byte of image) {
    const code = byte & 0o77;
    if (code === EOM) break;
    if (code === CR) flush();
    else record.push(code);
  }
  // A tape whose last line was not terminated still carries that line.
  flush();

  return lines.join('\n');
}
