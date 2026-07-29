import { CharsetError, type TokenizeError } from '../types';
import { atomCharset } from './charset';
import { atomKeywords } from './keywords';

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

/** Statement-opening keywords, for the statement-head check below. */
const COMMAND_WORDS = atomKeywords
  .filter((k) => k.kind === 'command')
  .map((k) => k.word);

/**
 * Check each `;`-separated statement of a line body against the forms Atom
 * BASIC can actually execute: a keyword (possibly crunched against what
 * follows, `PRINTA`), a dot-abbreviation (`P."HI"`), an assignment (`X=1`,
 * `A(1)=2`), or the indirection / system targets `?a=…`, `!a=…`, `$a=…`, `@=…`.
 * Anything else - typically a misspelled keyword - is a runtime ERROR on the
 * real machine, surfaced here as a lint error instead. The body is stored
 * verbatim either way; this never changes the program bytes.
 *
 * `asm` tracks the `[ … ]` inline-assembler block across lines; statement
 * heads inside it are 6502 source, not BASIC, and are not checked.
 */
function validateStatements(
  body: string,
  editorLine: number,
  colOffset: number,
  errors: TokenizeError[],
  asm: { active: boolean },
): void {
  let i = 0;

  const flag = (at: number, end: number, got: string): void => {
    errors.push({
      line: editorLine,
      column: colOffset + at,
      endColumn: colOffset + end,
      message: `Statement must start with a command keyword or assignment (got '${got}')`,
      // The body is stored verbatim regardless: the real ROM keeps such a line
      // and errors only when it executes, so this lint must not block the image.
      fatal: false,
    });
  };

  // A real Atom matches keywords byte-for-byte in upper case, so a lower-case
  // keyword lists fine but fails at RUN. Non-fatal, and import stays lenient.
  const warnLowerCase = (at: number, end: number, typed: string): void => {
    errors.push({
      line: editorLine,
      column: colOffset + at,
      endColumn: colOffset + end,
      message: `Lower-case keyword '${typed}' won't run on a real Atom — use ${typed.toUpperCase()}`,
      fatal: false,
    });
  };

  // Advance past the current statement: to just after the next ';' outside a
  // string, tracking assembler brackets on the way.
  const skipStatement = (): void => {
    let inString = false;
    while (i < body.length) {
      const c = body[i]!;
      if (c === '"') inString = !inString;
      else if (!inString && c === '[') asm.active = true;
      else if (!inString && c === ']') asm.active = false;
      else if (!inString && c === ';') {
        i++;
        return;
      }
      i++;
    }
  };

  while (i < body.length) {
    const c = body[i]!;
    if (c === ' ') {
      i++;
      continue;
    }
    if (asm.active) {
      // Assembler source: only watch for the closing ']'.
      if (c === ']') asm.active = false;
      else if (c === '"') {
        i++;
        while (i < body.length && body[i] !== '"') i++;
      }
      i++;
      continue;
    }
    if (c === ';') {
      i++; // empty statement
      continue;
    }
    if (c === '[') {
      asm.active = true;
      i++;
      continue;
    }
    if (
      c === '?' ||
      c === '!' ||
      c === '$' ||
      c === '@' ||
      c === '%' || // floating-point ROM variable (%A–%Z) assignment target
      c === '*' // COS / OS command (*CAT, *LOAD, *RUN, …)
    ) {
      skipStatement();
      continue;
    }
    const m = /^[A-Za-z]+/.exec(body.slice(i));
    if (m) {
      const word = m[0].toUpperCase();
      if (word.startsWith('REM')) return; // rest of the line is a comment
      const cmd = COMMAND_WORDS.find((k) => word.startsWith(k));
      if (cmd) {
        const typed = m[0].slice(0, cmd.length);
        if (typed !== typed.toUpperCase())
          warnLowerCase(i, i + cmd.length, typed);
        skipStatement();
        continue;
      }
      // Dot-abbreviation: the ROM expands e.g. P. to the first keyword that
      // starts with the letters typed.
      if (
        body[i + m[0].length] === '.' &&
        COMMAND_WORDS.some((k) => k.length > word.length && k.startsWith(word))
      ) {
        if (m[0] !== m[0].toUpperCase())
          warnLowerCase(i, i + m[0].length, m[0]);
        skipStatement();
        continue;
      }
      // Assignment: name, then '=' or an array subscript.
      let j = i + m[0].length;
      while (body[j] === ' ') j++;
      if (body[j] === '=' || body[j] === '(') {
        skipStatement();
        continue;
      }
      flag(i, i + m[0].length, m[0]);
      skipStatement();
      continue;
    }
    // One character may be an astral Semigraphics-6 sextant (a surrogate pair),
    // so report the whole code point rather than half of one.
    const ch = String.fromCodePoint(body.codePointAt(i)!);
    flag(i, i + ch.length, ch);
    skipStatement();
  }
}

/**
 * Tokenize plain-text Atom BASIC into the in-memory program layout the BASIC
 * ROM uses (and that lives at `#2900`): each line is stored as `0D` then the
 * line number big-endian then the line body as ASCII; the program ends with
 * `0D FF`. The Atom does almost no keyword packing - keywords are kept as text
 * - so the body is the source after the line number, verbatim, mapped through
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
  const asm = { active: false };

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

    validateStatements(body, editorLine, colOffset, errors, asm);

    prevLineNo = lineNo;
    out.push(LINE_MARK, (lineNo >> 8) & 0xff, lineNo & 0xff);
    for (const b of bodyBytes) out.push(b);
  }

  out.push(LINE_MARK, END_HI);
  return { bytes: Uint8Array.from(out), errors };
}
