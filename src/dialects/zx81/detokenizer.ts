import {
  zx81Charset,
  NEWLINE,
  NUMBER_MARKER,
  QUOTE,
  QUOTE_IMAGE,
} from './charset';
import { keywordByToken } from './keywords';
import { encodeZxFloat, floatOverrideNotation } from './zxfloat';

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
 * Convert a tokenized ZX81 program area back into editable text.
 * Spacing is normalized (a single space wherever two word-like tokens meet);
 * semantics round-trip exactly, byte layout does after re-tokenizing.
 */
export function detokenizeProgram(program: Uint8Array): string {
  const lines: string[] = [];
  let p = 0;

  while (p + 4 <= program.length) {
    const lineNo = (program[p]! << 8) | program[p + 1]!;
    const len = program[p + 2]! | (program[p + 3]! << 8);
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

  return lines.join('\n') + (lines.length ? '\n' : '');
}

/**
 * Structural problems in a tokenized ZX81 program area that the text form
 * cannot convey (truncation): a line whose length field runs past the end of
 * the program area, or a line missing its NEWLINE terminator. Reported through
 * the import-fidelity report channel.
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
    if (len === 0 || program[p + len - 1] !== NEWLINE) {
      return [
        'A program line is missing its NEWLINE terminator (the file may be ' +
          'corrupt).',
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
