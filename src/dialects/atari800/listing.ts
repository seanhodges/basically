// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { atariCharset } from './charset';
import { ATASCII_EOL } from './atascii';

/**
 * The ATASCII listing - what `LIST "C:"` or `LIST "D:PROGRAM.LST"` writes.
 *
 * It is the program as text rather than as a structure: no header, no variable
 * tables, one record per line ended by `$9B`. That makes it the portable form -
 * `ENTER` reads it back on any Atari, whatever BASIC is fitted - and the form a
 * cross-assembler or a listing scanned off a magazine page arrives in.
 *
 * The bytes are ATASCII, not ASCII, so the graphics characters and the inverse
 * video a listing may carry inside a string survive the round trip; only the
 * line ending differs from what the editor holds.
 */

/** A listing's text as the tape or disk records it: ATASCII, `$9B` per line. */
export function listingToAtascii(text: string): Uint8Array {
  const lines = text.split('\n');
  // A trailing newline in the editor's text is a line ending, not an empty line.
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

  const records = lines.map((line) => atariCharset.toMachine(line));
  const total = records.reduce((n, r) => n + r.length + 1, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const record of records) {
    out.set(record, at);
    at += record.length;
    out[at++] = ATASCII_EOL;
  }
  return out;
}

/** An ATASCII listing back to editor text. */
export function atasciiToListing(bytes: Uint8Array): string {
  const lines: string[] = [];
  let start = 0;
  for (let at = 0; at < bytes.length; at++) {
    if (bytes[at] !== ATASCII_EOL) continue;
    lines.push(atariCharset.toUnicode(bytes.subarray(start, at)));
    start = at + 1;
  }
  // Whatever follows the last `$9B` is a line the writer never finished; keep
  // it rather than dropping text the user can see is there.
  if (start < bytes.length) {
    lines.push(atariCharset.toUnicode(bytes.subarray(start)));
  }
  return lines.join('\n');
}

/**
 * Whether `bytes` looks like an ATASCII listing.
 *
 * A listing always opens with a line number and always ends its lines with
 * `$9B`, and that pair is enough: no tokenized image starts with a digit (its
 * first two bytes are a zero word) and no plain-ASCII text file ends a line
 * with `$9B`.
 */
export function isAtasciiListing(bytes: Uint8Array): boolean {
  const first = bytes[0];
  if (first === undefined || first < 0x30 || first > 0x39) return false;
  return bytes.includes(ATASCII_EOL);
}
