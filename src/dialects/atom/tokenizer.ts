import { CharsetError, type TokenizeError } from '../types';
import { atomCharset } from './charset';

export interface TokenizedProgram {
  /** Full program image: per-line records followed by the `0D FF` end marker. */
  bytes: Uint8Array;
  errors: TokenizeError[];
}

/** Start-of-line marker that precedes every stored line. */
const LINE_MARK = 0x0d;
/** End-of-program marker: `0D FF` where a line number's high byte would sit. */
const END_HI = 0xff;

/**
 * Highest line number Atom BASIC stores. The line number occupies two bytes,
 * big-endian, and a high byte of 0xFF is the end-of-program marker, so the top
 * of the usable range is the documented 0–32767 (a 0x7F high byte at most).
 */
const MAX_LINE = 32767;

/**
 * Tokenize plain-text Atom BASIC into the in-memory program layout the BASIC
 * ROM uses (and that lives at `#2900`): each line is stored as `0D` then the
 * line number big-endian then the line body as ASCII; the program ends with
 * `0D FF`. The Atom does almost no keyword packing — keywords are kept as text
 * — so the body is the source after the line number, verbatim, mapped through
 * {@link atomCharset}. This is byte-for-byte what the ROM holds (validated by
 * booting the real ROM and reading `#2900` back), so the emulator can poke it
 * straight in at `#2900`.
 *
 * Errors (missing/out-of-range/non-ascending line numbers, unmappable
 * characters) are collected as {@link TokenizeError}[] with a 1-based line and
 * 0-based column; the tokenizer never throws.
 */
export function tokenizeProgram(source: string): TokenizedProgram {
  const out: number[] = [];
  const errors: TokenizeError[] = [];
  let prevLineNo = -1;

  const lines = source.split('\n');
  for (let li = 0; li < lines.length; li++) {
    let raw = lines[li]!;
    if (raw.endsWith('\r')) raw = raw.slice(0, -1);
    if (raw.trim() === '') continue;
    const editorLine = li + 1;

    const m = /^\s*(\d+)(.*)$/.exec(raw);
    if (!m) {
      errors.push({
        line: editorLine,
        column: 0,
        message: 'Missing line number',
      });
      continue;
    }
    const lineNo = parseInt(m[1]!, 10);
    if (lineNo > MAX_LINE) {
      errors.push({
        line: editorLine,
        column: 0,
        message: `Line number ${lineNo} out of range 0-${MAX_LINE}`,
      });
      continue;
    }
    if (lineNo <= prevLineNo) {
      errors.push({
        line: editorLine,
        column: 0,
        message: `Line number ${lineNo} not greater than previous line ${prevLineNo}`,
      });
      continue;
    }

    // The body is everything after the digits, kept verbatim (Atom preserves
    // spaces). Map it through the charset to validate it is representable.
    const body = m[2]!;
    const colOffset = raw.length - body.length;
    let bodyBytes: Uint8Array;
    try {
      bodyBytes = atomCharset.toMachine(body);
    } catch (e) {
      if (e instanceof CharsetError) {
        errors.push({
          line: editorLine,
          column: colOffset + e.index,
          message: e.message,
        });
        continue;
      }
      throw e;
    }

    prevLineNo = lineNo;
    out.push(LINE_MARK, (lineNo >> 8) & 0xff, lineNo & 0xff);
    for (const b of bodyBytes) out.push(b);
  }

  out.push(LINE_MARK, END_HI);
  return { bytes: Uint8Array.from(out), errors };
}
