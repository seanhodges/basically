// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { DetokenizeResult } from '../types';
import { atariCharset } from './charset';
import { ATASCII_EOL } from './atascii';
import { ATARI_FLOAT_BYTES, fromAtariFloat } from './bcd';
import { ATARI_TOKENS, atariExpressions, atariStatements } from './keywords';
import {
  isAtariImage,
  parseAtariImage,
  variableSpelling,
  type AtariVariable,
} from './basfile';
import { collectRecordData, isCasImage, parseCasImage } from './casfile';
import { atasciiToListing, isAtasciiListing } from './listing';

/**
 * Atari BASIC's `LIST`: a tokenized image back to editable text.
 *
 * The image is pre-parsed, so listing it is not a byte-for-byte substitution -
 * it is a walk that has to put back what the parse took out. Three things it
 * puts back are worth naming:
 *
 *  - **The variable names**, which the statements do not carry: a variable is
 *    an index into the name table, and the spelling comes from there.
 *  - **The spellings the parse collapsed**, where several tokens share one:
 *    all three `=` bytes list as `=`, all six `(` bytes as `(`.
 *  - **The keyword that was never stored.** An assignment written without `LET`
 *    is an implied-`LET` token with no spelling, and lists back the way it was
 *    typed - without the word.
 */

/** Statement token -> the word `LIST` prints for it. */
const STATEMENT_WORDS = new Map<number, string>(
  atariStatements.map((k) => [k.token, k.word]),
);
// The ROM stores `?` under its own statement token but lists it back in full.
STATEMENT_WORDS.set(0x28, 'PRINT');

/** Expression token -> its spelling. */
const EXPRESSION_WORDS = new Map<number, string>(
  atariExpressions.map((k) => [k.token, k.word]),
);

/** Tokens `LIST` surrounds with spaces, being words rather than symbols. */
const SPACED = new Set([0x17, 0x18, 0x19, 0x1a, 0x1b, 0x28, 0x29, 0x2a]);

/** Statement tokens whose remaining bytes are text rather than tokens. */
const VERBATIM = new Set([0x00, 0x01, ATARI_TOKENS.SYNTAX_ERROR]);

/**
 * A number as Atari BASIC prints it.
 *
 * The stored form is ten decimal digits and an exponent, so the shortest text
 * that reads back as the same value is the faithful one; anything longer is
 * this function inventing precision the machine does not hold.
 */
export function formatAtariNumber(value: number): string {
  if (Number.isInteger(value) && Math.abs(value) < 1e10) return String(value);
  // JavaScript spells an exponent `1e+21` where Atari BASIC spells it `1E+21`.
  return String(value).toUpperCase();
}

/** How a variable is written where it is mentioned, subscript bracket aside. */
function mention(variable: AtariVariable): string {
  // An array's name table entry ends with `(`, but the bracket has a token of
  // its own that prints it, so the mention stops at the name.
  return variable.kind === 'array' ? variable.name : variableSpelling(variable);
}

/** Append `text`, collapsing the double space two spaced words would make. */
function append(line: string, text: string): string {
  if (text.startsWith(' ') && line.endsWith(' ')) return line + text.slice(1);
  return line + text;
}

/** Decode one statement's tokens onto `line`. */
function listStatement(
  bytes: Uint8Array,
  variables: AtariVariable[],
  warnings: string[],
  lineNumber: number,
): string {
  if (bytes.length === 0) return '';
  const statement = bytes[0]!;
  let out = '';
  let at = 1;

  if (statement !== ATARI_TOKENS.IMPLIED_LET) {
    const word = STATEMENT_WORDS.get(statement);
    if (word === undefined) {
      warnings.push(
        `Line ${lineNumber} opens with token $${statement.toString(16)}, which is not an Atari BASIC statement.`,
      );
      return '';
    }
    out = word;
    if (VERBATIM.has(statement)) {
      // The stored text runs to the ATASCII end-of-line and holds no space
      // after the keyword, because the interpreter ate the one that separated
      // them. `LIST` puts it back, which is what makes the listing read the way
      // it was typed.
      const end = bytes.indexOf(ATASCII_EOL, at);
      const text = atariCharset.toUnicode(
        bytes.slice(at, end < 0 ? bytes.length : end),
      );
      return text === '' ? out : `${out} ${text}`;
    }
    if (bytes.length > 1) out += ' ';
  }

  while (at < bytes.length) {
    const token = bytes[at++]!;

    if (token === ATARI_TOKENS.END_OF_STATEMENT) break;
    if (token === 0x14) {
      out += ':';
      break;
    }

    if (token === ATARI_TOKENS.NUMERIC_CONSTANT) {
      const value = fromAtariFloat(bytes.slice(at, at + ATARI_FLOAT_BYTES));
      at += ATARI_FLOAT_BYTES;
      if (value === null) {
        warnings.push(
          `Line ${lineNumber} holds a numeric constant that is not a valid Atari float.`,
        );
        out += '0';
      } else {
        out += formatAtariNumber(value);
      }
      continue;
    }

    if (token === ATARI_TOKENS.STRING_CONSTANT) {
      const length = bytes[at++] ?? 0;
      out += `"${atariCharset.toUnicode(bytes.slice(at, at + length))}"`;
      at += length;
      continue;
    }

    if (token >= ATARI_TOKENS.VARIABLE_BASE) {
      const variable = variables[token - ATARI_TOKENS.VARIABLE_BASE];
      if (variable === undefined) {
        warnings.push(
          `Line ${lineNumber} mentions variable ${token - ATARI_TOKENS.VARIABLE_BASE}, which the name table does not hold.`,
        );
        out += '?';
      } else {
        out += mention(variable);
      }
      continue;
    }

    const word = EXPRESSION_WORDS.get(token);
    if (word === undefined) {
      warnings.push(
        `Line ${lineNumber} holds token $${token.toString(16)}, which has no Atari BASIC spelling.`,
      );
      continue;
    }
    out = append(out, SPACED.has(token) ? ` ${word} ` : word);
  }

  // Not trimmed: a statement ending in a spaced word - the `THEN` that hands
  // the rest of the line to a statement of its own - needs its trailing space
  // to survive the join. The whole line is trimmed once, at the end.
  return out;
}

/**
 * List a file back to text, reporting anything it could not hold.
 *
 * Three things arrive here, and which one a file is can be read off its first
 * bytes: a `.cas` opens with the FUJI chunk, a tokenized image opens with a
 * zero word, and an ATASCII listing opens with a line number. The cassette is
 * unwrapped to the image it carries and falls through to the same walk, so a
 * program imported off tape and one imported from disk list identically.
 */
export function detokenizeWithReport(image: Uint8Array): DetokenizeResult {
  if (isCasImage(image)) return listCassette(image);
  if (isAtasciiListing(image)) {
    return { source: atasciiToListing(image), warnings: [] };
  }
  if (!isAtariImage(image)) {
    return {
      source: '',
      warnings: [
        'This is not a tokenized Atari BASIC program: its pointer header does not check out.',
      ],
    };
  }
  return listImage(image);
}

/** The `.cas` import path: records back to the byte stream `CSAVE` wrote. */
function listCassette(image: Uint8Array): DetokenizeResult {
  const cas = parseCasImage(image);
  const { data, warnings } = collectRecordData(cas.records);
  const listed = detokenizeWithReport(data);
  return {
    ...listed,
    warnings: [...cas.warnings, ...warnings, ...listed.warnings],
  };
}

/** The walk proper: a tokenized image's lines, statement by statement. */
function listImage(image: Uint8Array): DetokenizeResult {
  const parsed = parseAtariImage(image);
  const warnings = [...parsed.warnings];
  const lines: string[] = [];

  for (const line of parsed.lines) {
    // The immediate-mode line sits past the program and is not part of it.
    if (line.number > 32767) continue;
    const text = line.statements
      .map((s) => listStatement(s, parsed.variables, warnings, line.number))
      .filter((s) => s.trim() !== '')
      .join('');
    lines.push(`${line.number} ${text}`.trimEnd());
  }

  return { source: lines.join('\n'), warnings };
}

/** List a tokenized image back to text. */
export function detokenizeProgram(image: Uint8Array): string {
  return detokenizeWithReport(image).source;
}
