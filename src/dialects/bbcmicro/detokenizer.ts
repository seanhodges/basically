import { decodeSpan, plainChar } from './charset';
import { BASIC_II, type BbcVariant } from './keywords';
import { LINE_NUMBER_TOKEN, decodeLineNumber } from './lineNumber';
import type { DetokenizeResult } from '../types';

/** Tokens whose remaining line is stored verbatim (no further tokenizing). */
const REM_TOKEN = 0xf4;
const DATA_TOKEN = 0xdc;
const THEN_TOKEN = 0x8c;
const ELSE_TOKEN = 0x8b;
const QUOTE = 0x22;
const COLON = 0x3a;
const STAR = 0x2a;
const rawByte = (b: number): string =>
  `{0x${b.toString(16).padStart(2, '0').toUpperCase()}}`;

/**
 * Convert a tokenized BBC BASIC program (the in-memory / SAVE layout produced
 * by {@link tokenizeProgram}) back into editable text, and report anything the
 * text form could not represent faithfully (structural damage in the byte
 * image). Decoding is context-aware, mirroring the tokenizer's own inbound
 * paths: keyword tokens and the 0x8D line-number marker are only interpreted in
 * expression context; inside a string, REM, DATA or a `*` command every byte is
 * copied through the charset's escape-aware literal decoder, so teletext codes,
 * VDU controls and top-bit graphics round-trip instead of being mis-read as
 * keywords.
 */
export function detokenizeWithReport(
  program: Uint8Array,
  variant: BbcVariant = BASIC_II,
): DetokenizeResult {
  const lines: string[] = [];
  const warnings: string[] = [];
  let p = 0;

  while (
    p + 3 < program.length &&
    program[p] === 0x0d &&
    program[p + 1] !== 0xff
  ) {
    const lineNo = (program[p + 1]! << 8) | program[p + 2]!;
    const len = program[p + 3]!;
    if (len < 4) {
      warnings.push(
        `Line ${lineNo} has an invalid length byte (${len}); import stopped here.`,
      );
      p = program.length; // consumed everything we can trust
      break;
    }
    if (p + len > program.length) {
      warnings.push(
        `Line ${lineNo} is truncated: it needs ${len} bytes but only ` +
          `${program.length - p} remain, so the file ends mid-program.`,
      );
      lines.push(
        `${lineNo}${decodeBody(program, p + 4, program.length, variant)}`,
      );
      p = program.length;
      break;
    }
    lines.push(`${lineNo}${decodeBody(program, p + 4, p + len, variant)}`);
    p += len;
  }

  // A well-formed program leaves us sitting on the 0x0D 0xFF end marker.
  const atEndMarker =
    p + 1 < program.length && program[p] === 0x0d && program[p + 1] === 0xff;
  if (warnings.length === 0 && !atEndMarker) {
    warnings.push(
      program.length === 0
        ? 'The file is empty.'
        : 'The program is missing its 0x0D 0xFF end marker; the file may be ' +
            'truncated or not a tokenized BBC BASIC program.',
    );
  }

  return { source: lines.join('\n') + (lines.length ? '\n' : ''), warnings };
}

/** Text-only detokenize (the {@link Dialect.detokenize} contract). */
export function detokenizeProgram(
  program: Uint8Array,
  variant: BbcVariant = BASIC_II,
): string {
  return detokenizeWithReport(program, variant).source;
}

function decodeBody(
  program: Uint8Array,
  start: number,
  end: number,
  variant: BbcVariant,
): string {
  let text = '';
  let i = start;
  // Statement-position state, tracked exactly as the tokenizer does: it decides
  // whether a leading '*' is an OS command (verbatim rest-of-line) or a
  // multiply operator, and it is reset by ':' and after THEN/ELSE. Spaces
  // preserve it.
  let statementStart = true;

  const decodeLiteralToEnd = (): void => {
    while (i < end) {
      const { text: t, length } = decodeSpan(program, i, end);
      text += t;
      i += length;
    }
  };

  while (i < end) {
    const b = program[i]!;

    // Line-number marker (expression context only).
    if (b === LINE_NUMBER_TOKEN && i + 3 < end) {
      text += decodeLineNumber(
        program[i + 1]!,
        program[i + 2]!,
        program[i + 3]!,
      );
      i += 4;
      statementStart = false;
      continue;
    }

    // Keyword tokens.
    const word = b >= 0x80 ? variant.wordByToken.get(b) : undefined;
    if (word !== undefined) {
      text += word;
      i++;
      if (b === REM_TOKEN || b === DATA_TOKEN) {
        decodeLiteralToEnd();
        break;
      }
      statementStart = b === THEN_TOKEN || b === ELSE_TOKEN;
      continue;
    }

    // Spaces/tabs are copied verbatim and leave statement state intact.
    if (b === 0x20 || b === 0x09) {
      text += String.fromCharCode(b);
      i++;
      continue;
    }

    // String literal: copied verbatim through the escape-aware decoder.
    if (b === QUOTE) {
      text += '"';
      i++;
      while (i < end && program[i] !== QUOTE) {
        const { text: t, length } = decodeSpan(program, i, end);
        text += t;
        i += length;
      }
      if (i < end) {
        text += '"';
        i++;
      }
      statementStart = false;
      continue;
    }

    // '*' OS command at a statement start: the rest of the line is literal.
    if (b === STAR && statementStart) {
      text += '*';
      i++;
      decodeLiteralToEnd();
      break;
    }

    // ':' opens a new statement.
    if (b === COLON) {
      text += ':';
      i++;
      statementStart = true;
      continue;
    }

    // Any other expression byte: a plain character, or a raw escape for a
    // (ROM-impossible here) non-printable so the decode stays total.
    const plain = plainChar(b);
    text += plain !== undefined ? plain : rawByte(b);
    i++;
    statementStart = false;
  }

  return text;
}
