// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { ATARI_MAX_VARIABLES } from './keywords';

/**
 * The Atari BASIC tokenized program image - what `SAVE` writes, what `LOAD`
 * reads, and what a `.BAS` file holds.
 *
 * Atari BASIC does not store a line as a string of tokens the way the
 * Microsoft-family machines do. It stores a **pre-parsed structure**: the
 * variables a program mentions are lifted out into two tables of their own and
 * referred to by index, and each line carries the offsets the interpreter needs
 * to skip a statement without scanning it. So building an image means building
 * all four regions, not just tokenizing text.
 *
 * ```
 *   header   7 words, each a pointer minus LOMEM, so the first is always 0
 *   VNT      variable names, MSB set on the last character of each
 *   VNTD     one zero byte, the name table's dummy end
 *   VVT      8 bytes per variable, in the same order as the VNT
 *   STMTAB   the program: one record per line, ascending
 *   STMCUR   the immediate-mode line
 * ```
 *
 * The saved byte block starts at VNTP, not at LOMEM: the 256 bytes between them
 * are the token output buffer BASIC parses into, which holds nothing worth
 * keeping. That gap is why `VNTP - LOMEM` is `$100` rather than zero, and it is
 * the one part of the header a reader is likely to get wrong.
 */

/** Bytes of pointer header at the start of the image. */
export const HEADER_BYTES = 14;

/**
 * Bytes between LOMEM and VNTP: the token output buffer BASIC parses a typed
 * line into before committing it to the statement table. Not saved, but its
 * size is baked into every pointer in the header.
 */
export const TOKEN_BUFFER_BYTES = 0x100;

/** The line number of the immediate-mode line, which sits past the program. */
export const IMMEDIATE_LINE = 0x8000;

/** Highest line number a program may use; above it is the immediate line. */
export const MAX_LINE_NUMBER = 32767;

/** Bytes in one variable value table entry. */
const VVT_ENTRY_BYTES = 8;

/** What a variable's name ends with, and what its value entry's type byte is. */
const KINDS = {
  number: { terminator: '', type: 0x00 },
  string: { terminator: '$', type: 0x80 },
  array: { terminator: '(', type: 0x40 },
} as const;

/** The three shapes a name in the variable name table can take. */
export type AtariVariableKind = keyof typeof KINDS;

/** One entry of the variable name table, as the program spells it. */
export interface AtariVariable {
  /** The bare name, without its `$` or `(` terminator, e.g. `SCORE`. */
  name: string;
  kind: AtariVariableKind;
}

/** One line of the statement table. */
export interface AtariLine {
  number: number;
  /**
   * The line's statements, each already tokenized and carrying its own
   * terminator (`$14` for a colon, `$16` for the end of the line). The record's
   * offset bytes are computed from these, so a caller never writes one.
   */
  statements: Uint8Array[];
}

/** A whole program, in the form {@link buildAtariImage} assembles. */
export interface AtariProgram {
  variables: AtariVariable[];
  lines: AtariLine[];
}

/** How a variable is written into the name table: name, then a tagged end. */
export function variableNameBytes(variable: AtariVariable): Uint8Array {
  const spelling = variable.name + KINDS[variable.kind].terminator;
  const bytes = new Uint8Array(spelling.length);
  for (let i = 0; i < spelling.length; i++) bytes[i] = spelling.charCodeAt(i);
  // The high bit on the last character is what marks the end of a name; the
  // table has no separators of its own.
  bytes[bytes.length - 1] |= 0x80;
  return bytes;
}

/** How a variable is spelled in a listing: `A`, `A$`, `A(`. */
export function variableSpelling(variable: AtariVariable): string {
  return variable.name + KINDS[variable.kind].terminator;
}

/**
 * One line's record: line number, the offset past the line, then each statement
 * behind the offset past *it*.
 *
 * Both offsets are measured from the start of the record rather than from where
 * they sit, which is what lets the interpreter add one to a line pointer and
 * land on the next line or the next statement without looking at the tokens in
 * between.
 */
function buildLine(line: AtariLine): Uint8Array {
  const bodyLength = line.statements.reduce((n, s) => n + s.length + 1, 0);
  const total = 3 + bodyLength;
  const out = new Uint8Array(total);
  out[0] = line.number & 0xff;
  out[1] = (line.number >> 8) & 0xff;
  out[2] = total;

  let at = 3;
  for (const statement of line.statements) {
    out[at] = at + 1 + statement.length;
    out.set(statement, at + 1);
    at += 1 + statement.length;
  }
  return out;
}

/** The empty immediate-mode line every saved image ends with. */
function immediateLine(): Uint8Array {
  return buildLine({ number: IMMEDIATE_LINE, statements: [] });
}

function writeWord(out: Uint8Array, at: number, value: number): void {
  out[at] = value & 0xff;
  out[at + 1] = (value >> 8) & 0xff;
}

/** The tokenized image for `program`, header and all. */
export function buildAtariImage(program: AtariProgram): Uint8Array {
  const names = program.variables.map(variableNameBytes);
  const vntLength = names.reduce((n, b) => n + b.length, 0);
  const vvtLength = program.variables.length * VVT_ENTRY_BYTES;
  const lines = program.lines.map(buildLine);
  const programLength = lines.reduce((n, b) => n + b.length, 0);
  const immediate = immediateLine();

  // Every pointer is an offset from LOMEM, and the token buffer sits first.
  const vntp = TOKEN_BUFFER_BYTES;
  const vntd = vntp + vntLength;
  const vvtp = vntd + 1;
  const stmtab = vvtp + vvtLength;
  const stmcur = stmtab + programLength;
  const starp = stmcur + immediate.length;

  const out = new Uint8Array(HEADER_BYTES + (starp - vntp));
  writeWord(out, 0, 0);
  writeWord(out, 2, vntp);
  writeWord(out, 4, vntd);
  writeWord(out, 6, vvtp);
  writeWord(out, 8, stmtab);
  writeWord(out, 10, stmcur);
  writeWord(out, 12, starp);

  let at = HEADER_BYTES;
  for (const name of names) {
    out.set(name, at);
    at += name.length;
  }
  out[at++] = 0; // the dummy byte at VNTD

  for (let i = 0; i < program.variables.length; i++) {
    // Undimensioned at save time: the low bit of the type byte is BASIC's
    // "this one has been DIMed" flag, and RUN is what sets it.
    out[at] = KINDS[program.variables[i]!.kind].type;
    out[at + 1] = i;
    at += VVT_ENTRY_BYTES;
  }

  for (const line of lines) {
    out.set(line, at);
    at += line.length;
  }
  out.set(immediate, at);
  return out;
}

/** The seven header pointers, as offsets from LOMEM. */
export interface AtariImageHeader {
  vntp: number;
  vntd: number;
  vvtp: number;
  stmtab: number;
  stmcur: number;
  starp: number;
}

/** A line as {@link parseAtariImage} recovers it: number plus its statements. */
export interface ParsedLine {
  number: number;
  /** Each statement's tokens, terminator included. */
  statements: Uint8Array[];
}

/** What an image holds, and anything about it that did not add up. */
export interface ParsedImage {
  header: AtariImageHeader;
  variables: AtariVariable[];
  lines: ParsedLine[];
  warnings: string[];
}

function readWord(bytes: Uint8Array, at: number): number {
  return (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
}

/** Whether `image` looks like a tokenized Atari BASIC program. */
export function isAtariImage(image: Uint8Array): boolean {
  if (image.length < HEADER_BYTES) return false;
  // The first word is LOMEM minus itself, so it is zero in every saved image,
  // and the pointers after it ascend. That pair rules out a plain ATASCII
  // listing, whose first two bytes are a line number's digits.
  if (readWord(image, 0) !== 0) return false;
  let previous = 0;
  for (let at = 2; at < HEADER_BYTES; at += 2) {
    const pointer = readWord(image, at);
    if (pointer < previous) return false;
    previous = pointer;
  }
  const vntp = readWord(image, 2);
  if (vntp === 0) return false;
  // The saved block is exactly VNTP to STARP, so the header predicts the file's
  // own length. Checking that rather than the size of the LOMEM gap keeps the
  // test specific to the format without assuming which BASIC wrote it.
  return image.length === HEADER_BYTES + readWord(image, 12) - vntp;
}

/**
 * Read a tokenized image back into its variables and lines.
 *
 * Recovers what it can rather than refusing a damaged image: a truncated table
 * or a line running past the end of the data is reported in `warnings` and the
 * rest is still returned, because an import that drops a whole program on one
 * bad byte is worse than one that says which byte.
 */
export function parseAtariImage(image: Uint8Array): ParsedImage {
  const warnings: string[] = [];
  const header: AtariImageHeader = {
    vntp: readWord(image, 2),
    vntd: readWord(image, 4),
    vvtp: readWord(image, 6),
    stmtab: readWord(image, 8),
    stmcur: readWord(image, 10),
    starp: readWord(image, 12),
  };

  /** A header pointer as an index into `image`. */
  const offset = (pointer: number) => HEADER_BYTES + pointer - header.vntp;

  const variables: AtariVariable[] = [];
  const nameEnd = Math.min(offset(header.vntd), image.length);
  let name = '';
  for (let at = offset(header.vntp); at < nameEnd; at++) {
    const byte = image[at]!;
    const ch = String.fromCharCode(byte & 0x7f);
    if ((byte & 0x80) === 0) {
      name += ch;
      continue;
    }
    if (ch === '$') variables.push({ name, kind: 'string' });
    else if (ch === '(') variables.push({ name, kind: 'array' });
    else variables.push({ name: name + ch, kind: 'number' });
    name = '';
  }
  if (name !== '') {
    warnings.push(
      'The variable name table ends mid-name; the last name was dropped.',
    );
  }
  if (variables.length > ATARI_MAX_VARIABLES) {
    warnings.push(
      `The variable name table holds ${variables.length} names, more than the ${ATARI_MAX_VARIABLES} Atari BASIC can address.`,
    );
  }

  const lines: ParsedLine[] = [];
  const programEnd = Math.min(offset(header.stmcur), image.length);
  let at = offset(header.stmtab);
  while (at + 3 <= programEnd) {
    const number = readWord(image, at);
    const length = image[at + 2]!;
    if (length < 3 || at + length > programEnd) {
      warnings.push(
        `Line ${number} claims ${length} bytes, which runs past the end of the program.`,
      );
      break;
    }
    const statements: Uint8Array[] = [];
    let cursor = at + 3;
    while (cursor < at + length) {
      const next = image[cursor]!;
      if (next <= cursor - at || next > length) {
        warnings.push(`Line ${number} has a statement offset that goes back.`);
        break;
      }
      statements.push(image.slice(cursor + 1, at + next));
      cursor = at + next;
    }
    lines.push({ number, statements });
    at += length;
  }

  return { header, variables, lines, warnings };
}
