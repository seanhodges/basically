import { zx80Charset, NEWLINE, QUOTE, QUOTE_IMAGE } from './charset';
import { keywordByToken } from './keywords';
import { formatBinaryDirective } from '../binaryDirective';
import { PROGRAM_BASE } from './sysvars';

const WORDLIKE = /[A-Z0-9$"%▘▝▀▖▌▞▛▒█▟▙▄▜▐▚▗\\]/;

const REM_TOKEN = 0xfe;
const OPEN_PAREN_TOKEN = 0xda;
const SPACE = 0x00;
/**
 * "USR" typed as its three letters: on the ZX80 the integral functions have no
 * one-byte token, so `USR(addr)` is stored as the characters U, S, R followed
 * by the `(` token, digit characters, and `)`.
 */
const USR_CHARS = zx80Charset.toMachine('USR');

/** Whether a byte is a decimal digit character (charset codes 0x1c-0x25). */
function isDigitCode(b: number): boolean {
  return b >= 0x1c && b <= 0x25;
}

/**
 * When to capture a program line as an opaque `#BIN` directive instead of
 * text. `strict` captures only lines that cannot be valid source (line number
 * out of 1-9999, not ascending, missing final NEWLINE); `heuristic`
 * additionally captures large REM bodies that are mostly non-printable - the
 * hidden-machine-code trick - which would otherwise fill the editor with
 * `\{NN}` escapes. The ZX80's records are NEWLINE-delimited (no length
 * field), so unlike the ZX81 a body can never embed a stray 0x76.
 */
export type BinaryLinePolicy = 'strict' | 'heuristic';

const HEURISTIC_MIN_REM_CONTENT = 64;
const HEURISTIC_RAW_ESCAPE_RATIO = 0.5;

/** Whether a byte has no printable form and would render as a `\{NN}` escape. */
function isRawEscapeByte(b: number): boolean {
  return zx80Charset.toUnicode([b]).startsWith('\\{');
}

/**
 * Addresses used as a `USR(<n>)` operand in the program's ordinary BASIC lines.
 * A REM whose machine-code entry address (the byte just after its REM token) is
 * one of these is being *called* as code, so it should round-trip as a `#BIN`
 * block even when its bytes happen to read as text - e.g. a routine that embeds
 * a printable message, which the size/non-printable-ratio heuristic misses.
 *
 * REM bodies and string literals are skipped so code bytes or a quoted "USR"
 * can't masquerade as a call. The ZX80 is integer-only, so the address is read
 * straight from the operand's decimal digit characters (no inline float).
 */
function collectUsrTargets(program: Uint8Array): Set<number> {
  const targets = new Set<number>();
  let p = 0;
  while (p + 2 <= program.length) {
    let recordEnd = p + 2;
    while (recordEnd < program.length && program[recordEnd] !== NEWLINE) {
      recordEnd++;
    }
    if (program[p + 2] !== REM_TOKEN) {
      let inString = false;
      for (let i = p + 2; i < recordEnd; i++) {
        if (program[i] === QUOTE) {
          inString = !inString;
          continue;
        }
        if (inString) continue;
        if (
          program[i] === USR_CHARS[0] &&
          program[i + 1] === USR_CHARS[1] &&
          program[i + 2] === USR_CHARS[2]
        ) {
          // Skip the '(' token and any spaces, then read the decimal operand.
          let j = i + 3;
          while (
            j < recordEnd &&
            (program[j] === SPACE || program[j] === OPEN_PAREN_TOKEN)
          ) {
            j++;
          }
          let value = 0;
          let digits = 0;
          while (j < recordEnd && isDigitCode(program[j]!)) {
            value = value * 10 + (program[j]! - 0x1c);
            j++;
            digits++;
          }
          if (digits > 0) targets.add(value & 0xffff);
        }
      }
    }
    p = recordEnd < program.length ? recordEnd + 1 : recordEnd;
  }
  return targets;
}

/**
 * Whether the record spanning `[start, end)` (line number at `start`, body
 * after it, terminator at `end - 1` unless `terminated` is false) must - or,
 * heuristically, should - be captured as a `#BIN` directive. Uses the same
 * running-max ascending rule as the tokenizer, so everything left as text is
 * guaranteed to re-tokenize without errors.
 */
function shouldCaptureBinary(
  program: Uint8Array,
  start: number,
  end: number,
  terminated: boolean,
  maxLineNo: number,
  policy: BinaryLinePolicy,
  usrTargets: Set<number>,
): boolean {
  const lineNo = (program[start]! << 8) | program[start + 1]!;
  if (lineNo < 1 || lineNo > 9999) return true;
  if (lineNo <= maxLineNo) return true;
  if (!terminated) return true;
  if (
    policy === 'heuristic' &&
    keywordByToken.get(program[start + 2]!)?.word === 'REM'
  ) {
    // A REM whose entry address is called via USR is machine code, even when
    // its bytes read as text - capture it so its block chip round-trips. The
    // code starts one byte past the REM token at start + 2.
    if (usrTargets.has((PROGRAM_BASE + start + 3) & 0xffff)) return true;

    const contentStart = start + 3;
    const contentEnd = end - 1; // exclude the terminator
    const contentLen = contentEnd - contentStart;
    if (contentLen >= HEURISTIC_MIN_REM_CONTENT) {
      let raw = 0;
      for (let i = contentStart; i < contentEnd; i++) {
        if (isRawEscapeByte(program[i]!)) raw++;
      }
      if (raw / contentLen > HEURISTIC_RAW_ESCAPE_RATIO) return true;
    }
  }
  return false;
}

/**
 * Convert a tokenized ZX80 program area back into editable text, capturing
 * lines that text cannot express (or that the heuristic deems machine code)
 * as verbatim `#BIN` directives. Lines are `u16 BE line number` + body +
 * NEWLINE (no length field), and there is no inline numeric value to skip -
 * numbers are stored as their digit characters. Spacing of text lines is
 * normalized; re-tokenizing the result round-trips byte-for-byte - and
 * `#BIN` lines byte-for-byte by construction.
 */
export function detokenizeProgramWithInfo(
  program: Uint8Array,
  policy: BinaryLinePolicy = 'heuristic',
): { source: string; binaryLines: number } {
  const lines: string[] = [];
  let binaryLines = 0;
  let maxLineNo = 0;
  let p = 0;

  const usrTargets = collectUsrTargets(program);

  while (p + 2 <= program.length) {
    const lineNo = (program[p]! << 8) | program[p + 1]!;

    // Delimit the record: body runs to the next NEWLINE (or the end of the
    // program area when the final record lost its terminator).
    let recordEnd = p + 2;
    while (recordEnd < program.length && program[recordEnd] !== NEWLINE) {
      recordEnd++;
    }
    const terminated = recordEnd < program.length;
    if (terminated) recordEnd++;

    if (
      shouldCaptureBinary(
        program,
        p,
        recordEnd,
        terminated,
        maxLineNo,
        policy,
        usrTargets,
      )
    ) {
      lines.push(formatBinaryDirective(program.slice(p, recordEnd)));
      binaryLines++;
      maxLineNo = Math.max(maxLineNo, lineNo);
      p = recordEnd;
      continue;
    }
    maxLineNo = Math.max(maxLineNo, lineNo);

    p += 2;

    let text = `${lineNo} `;
    // Set after emitting a word keyword: insert a space before the next
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

    while (p < program.length) {
      const b = program[p]!;
      if (b === NEWLINE) {
        p++;
        break;
      }

      if (inString) {
        if (b === QUOTE) {
          text += '"';
          inString = false;
        } else if (b === QUOTE_IMAGE) {
          text += '""';
        } else {
          text += zx80Charset.toUnicode([b]);
        }
        p++;
        continue;
      }

      if (b === QUOTE) {
        emit('"', true);
        inString = true;
        p++;
        continue;
      }
      const kw = keywordByToken.get(b);
      if (kw) {
        if (kw.word === 'REM') {
          emit('REM', true);
          // Rest of the line (up to the NEWLINE) is literal text, stored
          // verbatim - every byte round-trips as its charset form and trailing
          // spaces are significant. The ZX80 has no line-length field, so the
          // body cannot contain 0x76 (it would end the line on real hardware).
          let end = p + 1;
          while (end < program.length && program[end] !== NEWLINE) end++;
          // Trailing spaces would be eaten by the tokenizer's per-line trim, so
          // emit them as \{00} escapes to keep the REM body byte-exact.
          const rest = escapeTrailingSpaces(
            zx80Charset.toUnicode(program.slice(p + 1, end)),
          );
          if (rest !== '') text += ' ' + rest;
          p = end;
          continue;
        }
        if (/[A-Z]/.test(kw.word[0]!)) {
          emit(kw.word, true);
          pendingBoundary = true;
        } else {
          emit(kw.word, false); // symbol tokens: + - * / ** = > < ; , ( )
        }
        p++;
        continue;
      }
      const s = zx80Charset.toUnicode([b]);
      emit(s, /[A-Z0-9$%\\]/.test(s[0] ?? ''));
      p++;
    }

    lines.push(text.replace(/\s+$/, ''));
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
 * Emit a trailing run of spaces (charset code 0x00) as \{00} escapes so it
 * survives the tokenizer's per-line trim. Spaces elsewhere are left readable.
 */
function escapeTrailingSpaces(text: string): string {
  return text.replace(/ +$/, (run) => '\\{00}'.repeat(run.length));
}

/**
 * Structural problems in a tokenized ZX80 program area that the text form
 * cannot convey. A final record missing its NEWLINE terminator is not
 * reported here - the detokenizer captures it byte-exactly as a `#BIN`
 * directive instead - so the only detectable problem left is a lone trailing
 * byte (half a line number), which the record walk has to skip.
 */
export function structuralWarnings(program: Uint8Array): string[] {
  let p = 0;
  while (p + 2 <= program.length) {
    p += 2;
    while (p < program.length && program[p] !== NEWLINE) p++;
    if (p < program.length) p++; // the terminator
  }
  if (p < program.length) {
    return [
      'The program area ends with a partial line number (the file may be ' +
        'corrupt); the trailing byte cannot be preserved.',
    ];
  }
  return [];
}
