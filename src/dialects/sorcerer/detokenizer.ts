// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { decodeSpan } from './charset';
import { sorcererWordByToken } from './keywords';

const QUOTE = 0x22;
const REM_TOKEN = 0x8f;
const DATA_TOKEN = 0x83;
const STMT_SEP = 0x3a; // ':'

/**
 * Exidy Standard BASIC tokenized program bytes -> editor text: the inverse of
 * `tokenizer.ts`, and the half that has to be *total* from the start.
 *
 * The image is the bare program as it sits from the interpreter's program base
 * (the same bytes {@link import('./tokenizer').tokenizeProgram} produces): a
 * chain of `u16 link` + `u16 line number` + body + 0x00 records, ending with a
 * 0x0000 link. We follow the links, decode the line number, expand keyword
 * tokens (0x80-0xC6) to their LIST spelling and map every other byte through
 * the charset. A space follows each line number, matching LIST.
 *
 * Like the interpreter's own LIST, keyword expansion is suspended inside string
 * literals and after REM/DATA - but here the reason is round-tripping rather
 * than display: the tokenizer stores those regions verbatim, so a byte in the
 * 0x80-0xC6 range inside them is data, not a token, and expanding it would not
 * re-tokenize to the same bytes. That range is also where this machine keeps
 * its standard graphics set, so the suspension is what lets a graphics
 * character inside a string come back as itself rather than as `PRINT`. Every
 * byte the text form cannot show as a glyph gets a `{0xNN}` escape rather than
 * a lossy `?`, so nothing is silently lost.
 */
export function detokenizeProgram(image: Uint8Array): string {
  const lines: string[] = [];
  let p = 0;

  while (p + 2 <= image.length) {
    const link = image[p]! | (image[p + 1]! << 8);
    if (link === 0) break; // end-of-program marker
    // A non-null link with no room for a line number + terminator: the image is
    // truncated, and what is there has already been decoded.
    if (p + 4 > image.length) break;
    const lineNo = image[p + 2]! | (image[p + 3]! << 8);
    let i = p + 4;
    let body = '';
    let inString = false;
    let remRest = false; // REM: rest of the line is verbatim text
    let dataMode = false; // DATA: verbatim until an unquoted ':'
    while (i < image.length && image[i] !== 0x00) {
      const b = image[i]!;
      if (remRest) {
        body += decodeSpan(image, i, image.length).text;
      } else if (inString) {
        if (b === QUOTE) {
          inString = false;
          body += '"';
        } else {
          body += decodeSpan(image, i, image.length).text;
        }
      } else if (b === QUOTE) {
        inString = true;
        body += '"';
      } else if (dataMode) {
        if (b === STMT_SEP) {
          dataMode = false;
          body += ':';
        } else {
          body += decodeSpan(image, i, image.length).text;
        }
      } else {
        const word = sorcererWordByToken.get(b);
        if (word !== undefined) {
          body += word;
          if (b === REM_TOKEN) remRest = true;
          else if (b === DATA_TOKEN) dataMode = true;
        } else {
          body += decodeSpan(image, i, image.length).text;
        }
      }
      i++;
    }
    lines.push(`${lineNo} ${body}`);
    if (i >= image.length) break; // ran off the end without a terminator
    p = i + 1; // step past the line terminator
  }

  return lines.join('\n') + (lines.length ? '\n' : '');
}
