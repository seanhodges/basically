import {
  zx81Charset,
  NEWLINE,
  NUMBER_MARKER,
  QUOTE,
  QUOTE_IMAGE,
} from './charset';
import { keywordByToken } from './keywords';
import { encodeZxFloat, floatOverrideNotation } from './zxfloat';
import { formatBinaryDirective } from '../binaryDirective';

/**
 * When to capture a program line as an opaque `#BIN` directive instead of
 * text. `strict` captures only lines that cannot be valid source (line number
 * out of 1-9999, not ascending, embedded/missing NEWLINE); `heuristic`
 * additionally captures large REM bodies that are mostly non-printable - the
 * hidden-machine-code trick in its well-formed shape - which would otherwise
 * fill the editor with `\{NN}` escapes.
 */
export type BinaryLinePolicy = 'strict' | 'heuristic';

const HEURISTIC_MIN_REM_CONTENT = 64;
const HEURISTIC_RAW_ESCAPE_RATIO = 0.5;

/** Whether a byte has no printable form and would render as a `\{NN}` escape. */
function isRawEscapeByte(b: number): boolean {
  return zx81Charset.toUnicode([b]).startsWith('\\{');
}

/**
 * Whether the record `[lineNo][len][body..]` starting its body at `bodyStart`
 * must (or, heuristically, should) be captured as a `#BIN` directive. Uses the
 * same running-max ascending rule as the tokenizer, so everything left as text
 * is guaranteed to re-tokenize without errors.
 */
function shouldCaptureBinary(
  program: Uint8Array,
  lineNo: number,
  len: number,
  bodyStart: number,
  maxLineNo: number,
  policy: BinaryLinePolicy,
): boolean {
  const recordEnd = bodyStart + len;
  if (lineNo < 1 || lineNo > 9999) return true;
  if (lineNo <= maxLineNo) return true;
  if (len === 0 || program[recordEnd - 1] !== NEWLINE) return true;
  for (let i = bodyStart; i < recordEnd - 1; i++) {
    if (program[i] === NEWLINE) return true;
  }
  if (
    policy === 'heuristic' &&
    keywordByToken.get(program[bodyStart]!)?.word === 'REM'
  ) {
    const contentStart = bodyStart + 1;
    const contentLen = recordEnd - 1 - contentStart;
    if (contentLen >= HEURISTIC_MIN_REM_CONTENT) {
      let raw = 0;
      for (let i = contentStart; i < recordEnd - 1; i++) {
        if (isRawEscapeByte(program[i]!)) raw++;
      }
      if (raw / contentLen > HEURISTIC_RAW_ESCAPE_RATIO) return true;
    }
  }
  return false;
}

const WORDLIKE = /[A-Z0-9$"%▘▝▀▖▌▞▛▒█▟▙▄▜▐▚▗\\]/;

/** Codes that can form a printed numeric literal (digits, '.', 'E', +/-). */
const NUMBER_CHAR = new Set<number>([
  ...Array.from({ length: 10 }, (_, d) => 0x1c + d), // 0-9
  0x1b, // .
  0x2a, // E
  0x15, // +
  0x16, // -
]);

/**
 * Emit a trailing run of spaces (charset code 0x00) as \{00} escapes so it
 * survives the tokenizer's per-line trim. Spaces elsewhere are left readable.
 */
function escapeTrailingSpaces(text: string): string {
  return text.replace(/ +$/, (run) => '\\{00}'.repeat(run.length));
}

/**
 * The printed number ending at the NUMBER_MARKER: the maximal grammar match
 * that is a suffix of the character codes preceding the marker (so the `5` in
 * `A+5`, not `+5`).
 */
function printedNumberBefore(program: Uint8Array, marker: number): string {
  let s = marker;
  while (s > 0 && NUMBER_CHAR.has(program[s - 1]!)) s--;
  const chars = zx81Charset.toUnicode(program.slice(s, marker));
  const m = /(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?$/.exec(chars);
  return m ? m[0] : '';
}

/**
 * Convert a tokenized ZX81 program area back into editable text, capturing
 * lines that text cannot express (or that the heuristic deems machine code) as
 * verbatim `#BIN` directives. Spacing of text lines is normalized (a single
 * space wherever two word-like tokens meet); semantics round-trip exactly,
 * byte layout does after re-tokenizing - and `#BIN` lines byte-for-byte.
 */
export function detokenizeProgramWithInfo(
  program: Uint8Array,
  policy: BinaryLinePolicy = 'heuristic',
): { source: string; binaryLines: number } {
  const lines: string[] = [];
  let binaryLines = 0;
  let maxLineNo = 0;
  let p = 0;

  while (p + 4 <= program.length) {
    const lineNo = (program[p]! << 8) | program[p + 1]!;
    const len = program[p + 2]! | (program[p + 3]! << 8);

    // A record whose length runs past the program area is truncated - it can't
    // splice back cleanly, so it stays text and structuralWarnings reports it.
    if (
      p + 4 + len <= program.length &&
      shouldCaptureBinary(program, lineNo, len, p + 4, maxLineNo, policy)
    ) {
      lines.push(formatBinaryDirective(program.slice(p, p + 4 + len)));
      binaryLines++;
      maxLineNo = Math.max(maxLineNo, lineNo);
      p += 4 + len;
      continue;
    }
    maxLineNo = Math.max(maxLineNo, lineNo);

    p += 4;
    const end = Math.min(p + len, program.length);

    let text = `${lineNo} `;
    // Set after emitting a keyword word: insert a space before the next
    // word-like token so "GOTO" + "10" renders as "GOTO 10".
    let pendingBoundary = false;
    let inString = false;

    const emit = (s: string, wordlike: boolean) => {
      if (s === '') return;
      const lastChar = text[text.length - 1]!;
      const needsGap =
        (pendingBoundary && wordlike) ||
        (wordlike &&
          /^[A-Z]/.test(s) &&
          WORDLIKE.test(lastChar) &&
          s.length > 1);
      if (needsGap && lastChar !== ' ') text += ' ';
      text += s;
      pendingBoundary = false;
    };

    let i = p;
    while (i < end) {
      const b = program[i]!;
      if (b === NEWLINE) break;

      if (inString) {
        if (b === QUOTE) {
          text += '"';
          inString = false;
        } else if (b === QUOTE_IMAGE) {
          text += '""';
        } else {
          text += zx81Charset.toUnicode([b]);
        }
        i++;
        continue;
      }

      if (b === QUOTE) {
        emit('"', true);
        inString = true;
        i++;
        continue;
      }
      if (b === NUMBER_MARKER) {
        // marker + 5-byte float; the printed digits precede it. Usually the
        // float is just the canonical encoding of those digits and can be
        // dropped (the tokenizer re-derives it). When it differs (a protection
        // trick, or absent digits), emit an override so it survives.
        const stored = program.slice(i + 1, i + 6);
        const printed = printedNumberBefore(program, i);
        let canonical = false;
        if (printed !== '') {
          try {
            const reEncoded = encodeZxFloat(parseFloat(printed));
            canonical = reEncoded.every((byte, k) => byte === stored[k]);
          } catch {
            canonical = false;
          }
        }
        if (!canonical) text += floatOverrideNotation(stored);
        i += 6;
        continue;
      }
      const kw = keywordByToken.get(b);
      if (kw) {
        if (kw.word === 'REM') {
          emit('REM', true);
          // The body runs to the line's NEWLINE terminator (at end-1). It is
          // stored verbatim - possibly machine code - so every byte round-trips
          // as its charset form, including embedded 0x76 (as \{76}). Trailing
          // spaces would be eaten by the tokenizer's per-line trim, so they are
          // emitted as \{00} escapes. The tokenizer skips exactly one space
          // after REM, so a single leading space here is absorbed on re-tokenize.
          const rest = escapeTrailingSpaces(
            zx81Charset.toUnicode(program.slice(i + 1, end - 1)),
          );
          if (rest !== '') text += ' ' + rest;
          i = end;
          break;
        }
        if (/[A-Z]/.test(kw.word[0]!)) {
          emit(kw.word, true);
          pendingBoundary = true;
        } else {
          emit(kw.word, false); // symbol tokens: ** <= >= <>
        }
        i++;
        continue;
      }
      const s = zx81Charset.toUnicode([b]);
      emit(s, /[A-Z0-9$%\\]/.test(s[0] ?? ''));
      i++;
    }

    lines.push(text.replace(/\s+$/, ''));
    p += len;
  }

  return {
    source: lines.join('\n') + (lines.length ? '\n' : ''),
    binaryLines,
  };
}

/** Text-only view of {@link detokenizeProgramWithInfo} (default policy). */
export function detokenizeProgram(program: Uint8Array): string {
  return detokenizeProgramWithInfo(program).source;
}

/**
 * Structural problems in a tokenized ZX81 program area that the text form
 * cannot convey: a line whose length field runs past the end of the program
 * area (truncation), or trailing bytes that are not a complete line. A line
 * merely missing its NEWLINE terminator is not reported here - the detokenizer
 * captures it byte-exactly as a `#BIN` directive instead.
 */
export function structuralWarnings(program: Uint8Array): string[] {
  let p = 0;
  while (p + 4 <= program.length) {
    const len = program[p + 2]! | (program[p + 3]! << 8);
    p += 4;
    if (p + len > program.length) {
      return [
        'The program area is truncated: the last line runs past the end of ' +
          'the file.',
      ];
    }
    p += len;
  }
  if (p !== program.length) {
    return [
      'The program area has trailing bytes that are not a complete line.',
    ];
  }
  return [];
}
