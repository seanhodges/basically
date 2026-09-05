// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { DetokenizeResult } from '../types';
import { apple2plusWordByToken } from './keywords';

/**
 * A tokenized Applesoft program -> editable text.
 *
 * The spacing is LIST's, and it is not cosmetic. LIST prints a space either
 * side of every token, and it has to: the tokenizer next door reads `ATO` as
 * `A` + TO and `AT O` as AT + `O`, so a listing that ran its tokens together
 * would say something different from the program it came from. Writing the
 * spaces back is what makes detokenize -> tokenize return the original bytes
 * for every construct on this machine, and it is why a listing here looks the
 * way an Apple II Plus listing looks.
 *
 * The one place the spacing departs from LIST is **after REM and DATA**, where
 * the trailing space is dropped: everything after those tokens is stored as
 * typed, so a space added here would be a byte added to the program.
 *
 * Token expansion stops in the three places the tokenizer stores bytes
 * verbatim - inside a string, after REM to the end of the line, and inside DATA
 * to an unquoted colon - so a byte in the token range that a program put there
 * comes back as itself rather than as a keyword. That makes this the tokenizer's
 * inverse rather than LIST's twin: the ROM does decode tokens inside strings,
 * and a listing that did the same here would not re-tokenize.
 */

/** The printable span a typed line can hold: space to underscore. */
const FIRST_PRINTABLE = 0x20;
const LAST_PRINTABLE = 0x5f;

/** A byte with no character of its own, written the way the tokenizer reads it. */
function escaped(byte: number): string {
  return `{0x${byte.toString(16).toUpperCase().padStart(2, '0')}}`;
}

function plainChar(byte: number): string {
  return byte >= FIRST_PRINTABLE && byte <= LAST_PRINTABLE
    ? String.fromCharCode(byte)
    : escaped(byte);
}

/** Where the rest of the bytes are stored as typed rather than tokenized. */
type Verbatim = 'none' | 'string' | 'rem' | 'data';

const REM_TOKEN = 0xb2;
const DATA_TOKEN = 0x83;

/** One line's bytes as source text. */
function decodeBody(bytes: Uint8Array): string {
  let out = '';
  let mode: Verbatim = 'none';
  // A quote inside DATA suspends the colon that would otherwise end it, so the
  // string state has to remember what to go back to.
  let afterString: Verbatim = 'none';

  for (const byte of bytes) {
    if (mode === 'rem') {
      out += plainChar(byte);
      continue;
    }
    if (mode === 'string') {
      out += plainChar(byte);
      if (byte === 0x22) mode = afterString;
      continue;
    }
    if (byte === 0x22) {
      afterString = mode;
      mode = 'string';
      out += '"';
      continue;
    }
    if (mode === 'data') {
      out += plainChar(byte);
      if (byte === 0x3a) mode = 'none';
      continue;
    }

    const word = apple2plusWordByToken.get(byte);
    if (word !== undefined) {
      // REM and DATA take everything after them literally, so the space LIST
      // would print here would become part of what they hold.
      const tail = byte === REM_TOKEN || byte === DATA_TOKEN ? '' : ' ';
      out += ` ${word}${tail}`;
      if (byte === REM_TOKEN) mode = 'rem';
      else if (byte === DATA_TOKEN) mode = 'data';
      continue;
    }
    out += plainChar(byte);
  }
  return out;
}

interface Walk {
  source: string;
  warnings: string[];
}

/**
 * Follow the links from the program base to the zero link that ends the
 * program, decoding each line.
 *
 * The links are absolute addresses rather than offsets, so they are only
 * meaningful against the base the program was saved from. They are not trusted
 * to step with: each line's length is found from its own `$00` terminator, and
 * the link is read only to notice the end. A program whose links were rewritten
 * for another base therefore still reads.
 */
function walkProgram(program: Uint8Array): Walk {
  const lines: string[] = [];
  const warnings: string[] = [];
  let pos = 0;

  while (pos + 1 < program.length) {
    const link = program[pos]! | (program[pos + 1]! << 8);
    if (link === 0) break;
    if (pos + 4 > program.length) {
      warnings.push('The program ends part-way through a line header.');
      break;
    }
    const lineNo = program[pos + 2]! | (program[pos + 3]! << 8);
    let end = pos + 4;
    while (end < program.length && program[end] !== 0x00) end++;
    if (end >= program.length) {
      warnings.push(
        `Line ${lineNo} runs off the end of the image; it was read as far as it goes.`,
      );
      lines.push(`${lineNo} ${decodeBody(program.subarray(pos + 4)).trim()}`);
      pos = program.length;
      break;
    }
    lines.push(
      `${lineNo} ${decodeBody(program.subarray(pos + 4, end)).trim()}`,
    );
    pos = end + 1;
  }

  // Everything past the zero link is somebody else's - a shape table, a routine
  // poked in behind the program - and there is nowhere in a listing to put it.
  const tail = pos + 2;
  if (pos + 1 < program.length && tail < program.length) {
    const extra = program.length - tail;
    warnings.push(
      `${extra} byte${extra === 1 ? '' : 's'} follow the program's end marker and are not part of the listing.`,
    );
  }

  return { source: lines.length ? lines.join('\n') + '\n' : '', warnings };
}

export function detokenizeProgram(program: Uint8Array): string {
  return walkProgram(program).source;
}

/** As {@link detokenizeProgram}, with what the text form could not carry. */
export function detokenizeProgramWithReport(
  program: Uint8Array,
): DetokenizeResult {
  const { source, warnings } = walkProgram(program);
  if (program.length === 0) {
    return { source: '', warnings: ['The image is empty.'] };
  }
  return { source, warnings };
}
