// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { CR, LF, ge635Charset } from './charset';

/**
 * GE-635 paper tape -> editor text: the inverse of `tokenizer.ts`, and the
 * half that has to be *total* from the start.
 *
 * The image is a run of ASCII codes with a carriage return and a line feed
 * closing each line. Every code the Teletype cannot print gets a `{0xNN}`
 * escape rather than a lossy `?`, so nothing is silently dropped and
 * re-encoding the text reproduces the tape byte for byte.
 *
 * Both line codes end a record rather than only the carriage return, and an
 * empty record is discarded, so a tape punched `CR LF` gives one line and not
 * a blank between every pair. That also reads a tape that carries only one of
 * the two, which is what a tape punched somewhere other than by `LISTNH` may
 * hold: the manual describes no framing (Appendix A), so being liberal about
 * it is the only honest reading.
 *
 * There is nothing here to stop at. The GE-235's tape ends with an
 * end-of-message code and this one has no terminator to look for - ASCII has
 * none and the manual names none - so the whole image is program.
 */
export function detokenizeProgram(image: Uint8Array): string {
  const lines: string[] = [];
  let record: number[] = [];

  const flush = (): void => {
    const text = ge635Charset.toUnicode(record);
    if (text.trim() !== '') lines.push(text);
    record = [];
  };

  for (const byte of image) {
    const code = byte & 0x7f;
    if (code === CR || code === LF) flush();
    else record.push(code);
  }
  // A tape whose last line was not terminated still carries that line.
  flush();

  return lines.join('\n');
}
