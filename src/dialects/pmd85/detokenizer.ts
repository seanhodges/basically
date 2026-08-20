// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { DetokenizeResult, MemoryBlock, TapeFile } from '../types';
import { decodeSpan } from './charset';
import { pmd85WordByToken } from './keywords';
import { codeFilesToBlocks } from '../importBlocks';
import { PROGRAM_BASE } from './addresses';
import {
  BASIC_FILE_TYPE,
  buildPtpImage,
  firstProgramFile,
  isTapeImage,
  parseTapeImage,
  programFromTapeFile,
  type Pmd85TapeFile,
} from './tape';

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
 * The image is either a `.ptp` / `.pmd` tape, which {@link unwrapTape} takes the
 * program out of, or the bare program as it sits from {@link PROGRAM_BASE} (the
 * same bytes {@link import('./tokenizer').tokenizeProgram} produces): a chain of
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
  return decodeLinkedProgram(unwrapTape(image).program).source;
}

/** What an import was handed: a tape, or the program area on its own. */
interface UnwrappedImage {
  /** The tokenized program, from {@link PROGRAM_BASE}. */
  program: Uint8Array;
  /** Import-fidelity notes from the container, if there was one. */
  warnings: string[];
  /** The other files on the tape, preserved so the deck can serve them. */
  tapeFiles: TapeFile[];
}

/**
 * Take a `.ptp` or `.pmd` tape off the program inside it.
 *
 * An image that is not a tape is taken to be the program area itself, which is
 * what the run and export paths pass around: the two cannot be confused,
 * because a tape opens with a header block's sixteen `FF` bytes and a program
 * opens with a link word that points just above {@link PROGRAM_BASE}.
 */
function unwrapTape(image: Uint8Array): UnwrappedImage {
  if (!isTapeImage(image))
    return { program: image, warnings: [], tapeFiles: [] };
  const parse = parseTapeImage(image);
  const { file, warnings } = firstProgramFile(parse);
  if (!file) {
    throw new Error(
      warnings[0] ?? 'The tape holds no BASIC-G program to open.',
    );
  }
  // Everything else on the tape rides along with the document, so a program
  // that loads its own data or overlay finds it on the emulator's deck.
  const extras = parse.files.filter((f) => f !== file).map(asTapeFile);
  return {
    program: programFromTapeFile(file),
    warnings: [...parse.warnings, ...warnings],
    tapeFiles: extras,
  };
}

/** One preserved tape file, wrapped as the single-file `.ptp` the deck reads. */
function asTapeFile(file: Pmd85TapeFile): TapeFile {
  const { header } = file;
  return {
    name: header.name.trim() || `FILE ${header.number}`,
    kind: header.type === BASIC_FILE_TYPE ? 'program' : 'data',
    tap: buildPtpImage([file]),
  };
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
 * A tape is unwrapped first, and anything else on it is preserved (see
 * {@link unwrapTape}). Whatever container it came in, the program area is plain
 * RAM with no header of its own, so anything *after* the end-of-program marker
 * is what would have been sitting straight above the program: it comes back as
 * a memory block at the address it followed the program at.
 */
export function detokenizeProgramWithReport(
  image: Uint8Array,
): DetokenizeResult {
  const tape = unwrapTape(image);
  const warnings: string[] = [...tape.warnings];
  const program = tape.program;
  const decoded = decodeLinkedProgram(program);
  if (decoded.truncated) {
    warnings.push(
      'The program looks truncated — the data ends before the end-of-program marker.',
    );
  }
  const trailing = program.length - decoded.end;
  let blocks: MemoryBlock[] | undefined;
  if (!decoded.truncated && trailing > 0) {
    const address = PROGRAM_BASE + decoded.end;
    blocks = codeFilesToBlocks([
      { name: '', address, bytes: program.slice(decoded.end) },
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
    ...(tape.tapeFiles.length > 0 ? { tapeFiles: tape.tapeFiles } : {}),
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
