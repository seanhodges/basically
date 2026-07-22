import type { DetokenizeResult } from '../types';
import { decodeSpan, plainChar } from './charset';
import { locoVariant, type LocoBasicVariant } from './keywords';
import { decodeLocoFloat, formatLocoFloat } from './numbers';

/**
 * Tokenized Locomotive BASIC program bytes → editable source. Numeric
 * constants are reformatted losslessly from their binary encodings (hex back
 * to `&…`, binary to `&X…`, reals to Locomotive's display form); spaces come
 * back verbatim because the tokenizer stores them. Structural damage and
 * anything the text form cannot reproduce byte-exactly (run-time variable
 * offsets, line-address pointers) is reported as an import warning.
 */

const STATEMENT_SEP = 0x01;
const APOSTROPHE = 0xc0;
const REM = 0xc5;
const DATA = 0x8c;
const RSX = 0x7c;
const QUOTE = 0x22;
const FF_PREFIX = 0xff;

const SMALL_INT_BASE = 0x0e;
const BYTE_INT = 0x19;
const WORD_INT = 0x1a;
const BINARY_INT = 0x1b;
const HEX_INT = 0x1c;
const LINE_POINTER = 0x1d;
const LINE_NUMBER = 0x1e;
const FLOAT = 0x1f;

/** Variable-definition tokens -> the type suffix they imply. */
const VAR_SUFFIX: Record<number, string> = {
  0x02: '%',
  0x03: '$',
  0x04: '!',
  0x0b: '', // unsuffixed, typed by a DEFINT/DEFSTR/DEFREAL range
  0x0c: '',
  0x0d: '',
};

/** BASIC program area start (`&170`), for resolving &1D line pointers. */
const PROGRAM_BASE = 0x0170;

const rawByte = (b: number): string =>
  `{0x${b.toString(16).padStart(2, '0').toUpperCase()}}`;

/** Decode with an import-fidelity report (see {@link DetokenizeResult}). */
export function detokenizeWithReport(
  program: Uint8Array,
  variant: LocoBasicVariant = 'basic10',
): DetokenizeResult {
  const tables = locoVariant(variant);
  const lines: string[] = [];
  const warnings: string[] = [];

  // Pre-scan the line records so &1D line-address pointers (left behind by a
  // program saved after running) can be resolved back to line numbers.
  const lineNoByAddress = new Map<number, number>();
  for (let p = 0; p + 1 < program.length; ) {
    const len = program[p]! | (program[p + 1]! << 8);
    if (len === 0 || len < 5 || p + len > program.length) break;
    lineNoByAddress.set(
      PROGRAM_BASE + p,
      program[p + 2]! | (program[p + 3]! << 8),
    );
    p += len;
  }

  let p = 0;
  let sawEnd = false;
  while (p + 1 < program.length) {
    const len = program[p]! | (program[p + 1]! << 8);
    if (len === 0) {
      sawEnd = true;
      break;
    }
    const lineNo = program[p + 2]! | (program[p + 3]! << 8);
    if (len < 5) {
      warnings.push(
        `Line ${lineNo} has an invalid length word (${len}); import stopped here.`,
      );
      break;
    }
    if (p + len > program.length) {
      warnings.push(
        `Line ${lineNo} is truncated: it needs ${len} bytes but only ` +
          `${program.length - p} remain, so the file ends mid-program.`,
      );
      lines.push(
        `${lineNo} ${decodeBody(program, p + 4, program.length, tables, warnings, lineNoByAddress)}`,
      );
      p = program.length;
      break;
    }
    // The record ends with a 0x00 terminator; decode the body before it.
    let end = p + len - 1;
    if (program[end] !== 0x00) {
      warnings.push(`Line ${lineNo} is missing its 0x00 terminator.`);
      end = p + len;
    }
    lines.push(
      `${lineNo} ${decodeBody(program, p + 4, end, tables, warnings, lineNoByAddress)}`,
    );
    p += len;
  }

  if (warnings.length === 0 && !sawEnd) {
    warnings.push(
      program.length === 0
        ? 'The file is empty.'
        : 'The program is missing its zero length-word end marker; the file ' +
            'may be truncated or not a tokenized Locomotive BASIC program.',
    );
  }

  return { source: lines.join('\n') + (lines.length ? '\n' : ''), warnings };
}

/** Text-only detokenize (the {@link Dialect.detokenize} contract). */
export function detokenizeProgram(
  program: Uint8Array,
  variant: LocoBasicVariant = 'basic10',
): string {
  return detokenizeWithReport(program, variant).source;
}

function decodeBody(
  program: Uint8Array,
  start: number,
  end: number,
  tables: ReturnType<typeof locoVariant>,
  warnings: string[],
  lineNoByAddress: Map<number, number>,
): string {
  let text = '';
  let i = start;

  const u16 = (at: number): number => program[at]! | (program[at + 1]! << 8);

  /**
   * Append a word-like unit (keyword or variable), inserting one space when
   * gluing it straight on would mis-parse - `?A` stores PRINT + variable A
   * with no separator, which must not read back as a variable "PRINTA".
   * Only a letter-to-letter junction is ambiguous: digits, type suffixes and
   * punctuation re-tokenize byte-exactly glued (`GOTO10`, `A$AND B`).
   */
  const appendWord = (unit: string): void => {
    if (/[A-Za-z]$/.test(text) && /^[A-Za-z]/.test(unit)) text += ' ';
    text += unit;
  };

  const decodeLiteralTo = (stop: (b: number) => boolean): void => {
    while (i < end && !stop(program[i]!)) {
      const { text: t, length } = decodeSpan(program, i, end);
      text += t;
      i += length;
    }
  };

  /** Variable / RSX name: bytes with bit 7 marking the last character. */
  const decodeName = (): string => {
    let name = '';
    while (i < end) {
      const b = program[i]!;
      name += String.fromCharCode(b & 0x7f);
      i++;
      if (b & 0x80) break;
    }
    return name;
  };

  while (i < end) {
    const b = program[i]!;

    // Statement separator; &01 &C0 is an apostrophe comment.
    if (b === STATEMENT_SEP) {
      i++;
      if (i < end && program[i] === APOSTROPHE) {
        text += "'";
        i++;
        decodeLiteralTo(() => false);
        break;
      }
      text += ':';
      continue;
    }
    if (b === APOSTROPHE) {
      text += "'";
      i++;
      decodeLiteralTo(() => false);
      break;
    }

    // Variable definitions: type token, 16-bit variables-area offset (zero
    // in a freshly tokenized program), then the name.
    const suffix = VAR_SUFFIX[b];
    if (suffix !== undefined) {
      i++;
      if (i + 1 < end && u16(i) !== 0) {
        warnings.push(
          'A run-time variable offset was reset to zero on import.',
        );
      }
      i += 2;
      appendWord(decodeName() + suffix);
      continue;
    }

    // Binary numeric constants.
    if (b >= SMALL_INT_BASE && b <= 0x18) {
      text += String(b - SMALL_INT_BASE);
      i++;
      continue;
    }
    if (b === BYTE_INT && i + 1 < end) {
      const value = program[i + 1]!;
      if (value <= 10) {
        warnings.push(
          `A byte-encoded constant ${value} will re-encode in its short form.`,
        );
      }
      text += String(value);
      i += 2;
      continue;
    }
    if (b === WORD_INT && i + 2 < end) {
      const value = u16(i + 1);
      if (value <= 0xff) {
        warnings.push(
          `A word-encoded constant ${value} will re-encode in its short form.`,
        );
      }
      text += String(value);
      i += 3;
      continue;
    }
    if (b === BINARY_INT && i + 2 < end) {
      text += `&X${u16(i + 1).toString(2)}`;
      i += 3;
      continue;
    }
    if (b === HEX_INT && i + 2 < end) {
      text += `&${u16(i + 1)
        .toString(16)
        .toUpperCase()}`;
      i += 3;
      continue;
    }
    if (b === LINE_POINTER && i + 2 < end) {
      const addr = u16(i + 1);
      const lineNo = lineNoByAddress.get(addr);
      if (lineNo !== undefined) {
        warnings.push(
          `A run-time line pointer (&${addr.toString(16).toUpperCase()}) was converted back to line ${lineNo}.`,
        );
        text += String(lineNo);
      } else {
        warnings.push(
          `A run-time line pointer (&${addr.toString(16).toUpperCase()}) matches no line in this program; its raw address was kept as a number.`,
        );
        text += String(addr);
      }
      i += 3;
      continue;
    }
    if (b === LINE_NUMBER && i + 2 < end) {
      text += String(u16(i + 1));
      i += 3;
      continue;
    }
    if (b === FLOAT && i + 5 < end) {
      const value = decodeLocoFloat(program, i + 1);
      if (Number.isInteger(value) && value >= 0 && value <= 0xffff) {
        warnings.push(
          `A real-encoded integer constant ${value} will re-encode in its short form.`,
        );
      }
      text += formatLocoFloat(value);
      i += 6;
      continue;
    }

    // String literals: bytes copied through the escape-aware decoder.
    if (b === QUOTE) {
      text += '"';
      i++;
      decodeLiteralTo((c) => c === QUOTE);
      if (i < end) {
        text += '"';
        i++;
      }
      continue;
    }

    // RSX command: '|' + ROM-filled offset byte + name.
    if (b === RSX) {
      i++;
      if (i < end && program[i] !== 0) {
        warnings.push(
          'A run-time RSX offset byte was reset to zero on import.',
        );
      }
      i++;
      text += `|${decodeName()}`;
      continue;
    }

    // Two-byte function tokens.
    if (b === FF_PREFIX) {
      const word =
        i + 1 < end ? tables.wordByFfToken.get(program[i + 1]!) : undefined;
      if (word === undefined) {
        warnings.push(
          `Unknown function token 0xFF ${rawByte(program[i + 1] ?? 0)} was kept as raw bytes.`,
        );
        text += rawByte(b);
        i++;
        continue;
      }
      appendWord(word);
      i += 2;
      continue;
    }

    // Single-byte keyword tokens.
    if (b >= 0x80) {
      const word = tables.wordBySingleToken.get(b);
      if (word === undefined) {
        warnings.push(`Unknown token ${rawByte(b)} was kept as raw bytes.`);
        text += rawByte(b);
        i++;
        continue;
      }
      appendWord(word);
      i++;
      if (b === REM) {
        decodeLiteralTo(() => false);
        break;
      }
      if (b === DATA) {
        decodeLiteralTo((c) => c === STATEMENT_SEP);
      }
      continue;
    }

    // Plain expression characters.
    const plain = plainChar(b);
    if (plain !== undefined) {
      text += plain;
      i++;
      continue;
    }
    warnings.push(
      `Unexpected byte ${rawByte(b)} outside a literal was kept as raw bytes.`,
    );
    text += rawByte(b);
    i++;
  }

  return text;
}
