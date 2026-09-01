// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { DetokenizeResult } from '../types';
import { decodeSpan } from './charset';
import { hb10pWordByToken } from './keywords';
import { decodeNumber, TOK_LINE_PTR } from './numbers';

const REM = 0x8f;
const DATA = 0x84;
const APOSTROPHE = 0xe6;
const ELSE = 0xa1;
const COLON = 0x3a;
const QUOTE = 0x22;
const FUNCTION_PREFIX = 0xff;
const FIRST_TOKEN = 0x81;

/**
 * Decode one line's body from `i`, stopping at the 0x00 that ends it.
 *
 * The terminator has to be found by decoding rather than by scanning ahead:
 * a float's BCD mantissa and a line reference's high byte are both routinely
 * zero, so a line's extent is only knowable once each constant has been
 * stepped over. Returns the index just past the terminator, or past `end` when
 * the line was cut short.
 */
function detokenizeLine(
  bytes: Uint8Array,
  i: number,
  end: number,
  warnings: Set<string>,
): { text: string; next: number } {
  let text = '';
  let inString = false;
  let remRest = false;
  let dataMode = false;

  while (i < end) {
    const b = bytes[i]!;
    if (b === 0x00) return { text, next: i + 1 };
    if (remRest || inString || dataMode) {
      if (inString && b === QUOTE) {
        text += '"';
        inString = false;
        i += 1;
        continue;
      }
      if (dataMode && b === COLON) {
        text += ':';
        dataMode = false;
        i += 1;
        continue;
      }
      const { text: t, length } = decodeSpan(bytes, i, end);
      text += t;
      i += length;
      continue;
    }
    if (b === QUOTE) {
      text += '"';
      inString = true;
      i += 1;
      continue;
    }
    // The two words stored behind a hidden colon. LIST shows neither colon,
    // so folding them back here is what makes a round trip byte-exact.
    if (b === COLON && bytes[i + 1] === REM && bytes[i + 2] === APOSTROPHE) {
      text += "'";
      remRest = true;
      i += 3;
      continue;
    }
    if (b === COLON && bytes[i + 1] === ELSE) {
      text += 'ELSE';
      i += 2;
      continue;
    }
    if (b === TOK_LINE_PTR) {
      warnings.add(
        'A line reference was still a run-time address, so the line numbers ' +
          'it points at may be wrong.',
      );
    }
    const num = decodeNumber(bytes, i);
    if (num) {
      text += num.text;
      i += num.length;
      continue;
    }
    if (b === FUNCTION_PREFIX) {
      const fn = hb10pWordByToken.get((b << 8) | (bytes[i + 1] ?? 0));
      if (fn) {
        text += fn.word;
        i += 2;
        continue;
      }
    }
    if (b >= FIRST_TOKEN) {
      const kw = hb10pWordByToken.get(b);
      if (kw) {
        text += kw.word;
        if (b === REM) remRest = true;
        else if (b === DATA) dataMode = true;
        i += 1;
        continue;
      }
      warnings.add(
        `The program uses token 0x${b.toString(16).toUpperCase()}, which MSX BASIC 1.0 does not define.`,
      );
      i += 1;
      continue;
    }
    const { text: t, length } = decodeSpan(bytes, i, end);
    text += t;
    i += length;
  }
  warnings.add('The last line was cut short and has been dropped.');
  return { text, next: end + 1 };
}

/**
 * Program bytes back to MSX BASIC text, walking the line records.
 *
 * The stored links are absolute addresses from whichever machine wrote the
 * file, so they are read only for the zero link that ends the program; each
 * line's extent comes from its own 0x00 terminator instead. That is what lets
 * a file saved anywhere in memory load here.
 */
export function detokenizeProgram(bytes: Uint8Array): DetokenizeResult {
  const warnings = new Set<string>();
  const lines: string[] = [];
  let i = 0;

  while (i + 1 < bytes.length) {
    const link = bytes[i]! | (bytes[i + 1]! << 8);
    if (link === 0) break;
    if (i + 4 >= bytes.length) {
      warnings.add('The last line was cut short and has been dropped.');
      break;
    }
    const lineNo = bytes[i + 2]! | (bytes[i + 3]! << 8);
    const line = detokenizeLine(bytes, i + 4, bytes.length, warnings);
    if (line.next > bytes.length) break;
    lines.push(`${lineNo} ${line.text}`);
    i = line.next;
  }

  return { source: lines.join('\n'), warnings: [...warnings] };
}
