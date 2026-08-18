// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { DetokenizeResult, MemoryBlock } from '../types';
import { decodeSpan } from './charset';
import { pmd85WordByToken } from './keywords';
import { codeFilesToBlocks } from '../importBlocks';
import { PROGRAM_BASE } from './addresses';

const QUOTE = 0x22;
const APOSTROPHE = 0x27;
const REM_TOKEN = 0x8e;
const DATA_TOKEN = 0x83;
const STMT_SEP = 0x3a; // ':'
/** Hexadecimal digits, matching the run a `'` literal may carry. */
const HEX_DIGITS = '0123456789ABCDEF';

/**
 * BASIC-G tokenized program bytes -> editor text: the inverse of `tokenizer.ts`,
 * and the half that has to be *total* from the start.
 *
 * The image is the bare program as it sits from {@link PROGRAM_BASE} (the same
 * bytes {@link import('./tokenizer').tokenizeProgram} produces): a chain of
 * `u16 link` + `u16 line number` + body + 0x00 records, ending with a 0x0000
 * link. We follow the links, decode the line number, expand keyword tokens
 * (0x80-0xE9) to their LIST spelling and map every other byte through the
 * charset. A space follows each line number, matching LIST.
 *
 * Like the interpreter's own LIST, keyword expansion is suspended inside string
 * literals, after REM/DATA and across a `'` hexadecimal literal - but here the
 * reason is round-tripping rather than display: the tokenizer stores those
 * regions verbatim, so a byte in the token range inside them is data, not a
 * token, and expanding it would not re-tokenize to the same bytes. Every byte
 * the text form cannot show as a glyph gets a `{0xNN}` escape rather than a
 * lossy `?`, so nothing is silently lost.
 */
export function detokenizeProgram(image: Uint8Array): string {
  return decodeLinkedProgram(image).source;
}

/** Format a byte address as `0xNNNN` for warning messages. */
function hex(n: number): string {
  return `0x${n.toString(16).toUpperCase().padStart(4, '0')}`;
}

/**
 * As {@link detokenizeProgram}, but reporting what the text form could not
 * capture: a truncated link chain, or bytes past the end-of-program marker.
 * The import UI prefers this over the bare `detokenize` when present.
 *
 * There is no container to unwrap. The program area is plain RAM below 0x8000
 * with no header in front of it, so an imported image is taken to be what
 * `tokenizeProgram` emits: program bytes from {@link PROGRAM_BASE}. Anything
 * *after* the end-of-program marker is what would have been sitting straight
 * above the program, so it comes back as a memory block at the address it
 * followed the program at.
 */
export function detokenizeProgramWithReport(
  image: Uint8Array,
): DetokenizeResult {
  const warnings: string[] = [];
  const decoded = decodeLinkedProgram(image);
  if (decoded.truncated) {
    warnings.push(
      'The program looks truncated — the data ends before the end-of-program marker.',
    );
  }
  const trailing = image.length - decoded.end;
  let blocks: MemoryBlock[] | undefined;
  if (!decoded.truncated && trailing > 0) {
    const address = PROGRAM_BASE + decoded.end;
    blocks = codeFilesToBlocks([
      { name: '', address, bytes: image.slice(decoded.end) },
    ]);
    warnings.push(
      `${trailing} byte${trailing === 1 ? '' : 's'} after the end-of-program ` +
        `marker (likely appended machine code) were preserved as a memory ` +
        `block at ${hex(address)}.`,
    );
  }
  return {
    source: decoded.source,
    warnings,
    ...(blocks ? { blocks } : {}),
  };
}

interface DecodeResult {
  source: string;
  /** Offset in `program` just past the 0x0000 end-of-program link. */
  end: number;
  /** True when the data ran out before an end-of-program marker was reached. */
  truncated: boolean;
}

function decodeLinkedProgram(program: Uint8Array): DecodeResult {
  const lines: string[] = [];
  let p = 0;
  let end = program.length;
  let truncated = false;
  let sawEnd = false;

  while (p + 2 <= program.length) {
    const link = program[p]! | (program[p + 1]! << 8);
    if (link === 0) {
      end = p + 2; // the null link is two bytes; anything past it is trailing
      sawEnd = true;
      break;
    }
    if (p + 4 > program.length) {
      // A non-null link with no room for a line number + terminator: truncated.
      truncated = true;
      end = program.length;
      break;
    }
    const lineNo = program[p + 2]! | (program[p + 3]! << 8);
    let i = p + 4;
    let body = '';
    let inString = false;
    let remRest = false; // REM: rest of the line is verbatim text
    let dataMode = false; // DATA: verbatim until an unquoted ':'
    let hexRest = false; // `'` literal: verbatim while the bytes are hex digits
    while (i < program.length && program[i] !== 0x00) {
      const b = program[i]!;
      if (hexRest && !HEX_DIGITS.includes(String.fromCharCode(b))) {
        hexRest = false;
      }
      if (remRest || hexRest) {
        body += decodeSpan(program, i, program.length).text;
      } else if (inString) {
        if (b === QUOTE) {
          inString = false;
          body += '"';
        } else {
          body += decodeSpan(program, i, program.length).text;
        }
      } else if (b === QUOTE) {
        inString = true;
        body += '"';
      } else if (dataMode) {
        if (b === STMT_SEP) {
          dataMode = false;
          body += ':';
        } else {
          body += decodeSpan(program, i, program.length).text;
        }
      } else if (b === APOSTROPHE) {
        hexRest = true;
        body += "'";
      } else {
        const word = pmd85WordByToken.get(b);
        if (word !== undefined) {
          body += word;
          if (b === REM_TOKEN) remRest = true;
          else if (b === DATA_TOKEN) dataMode = true;
        } else {
          body += decodeSpan(program, i, program.length).text;
        }
      }
      i++;
    }
    lines.push(`${lineNo} ${body}`);
    if (i >= program.length) {
      // Ran off the end without the line's 0x00 terminator: image is truncated.
      truncated = true;
      end = program.length;
      break;
    }
    p = i + 1; // step past the line terminator
  }

  // Leftover bytes that are neither an end marker nor a decodable line mean the
  // image stops short of its end marker.
  if (!sawEnd && !truncated && p < program.length) truncated = true;

  return {
    source: lines.join('\n') + (lines.length ? '\n' : ''),
    end,
    truncated,
  };
}
