import { CharsetError, type TokenizeError } from '../types';
import { parseC64Char } from './petscii';
import { c64KeywordsByLength, type C64Keyword } from './keywords';
import { PROGRAM_BASE } from './addresses';

export interface TokenizedProgram {
  /**
   * The tokenized program as it sits in memory from the program base ($0801 on
   * the C64): for each line a 2-byte link to the next line, the 2-byte line
   * number, the tokenized body and a 0x00 terminator, ending with a 0x0000 null
   * link. Prepend the 2-byte load address (little-endian, $01 $08 on the C64) to
   * get a .prg image.
   */
  program: Uint8Array;
  errors: TokenizeError[];
}

/**
 * A Commodore-BASIC machine variant. The C64 tokenizer is parameterized over
 * this so sibling dialects (PET, VIC-20…) reuse it byte-for-byte, differing only
 * in their program base address and keyword table. Omitting it tokenizes for the
 * C64 (base $0801, the plain BASIC V2 keyword table).
 */
export interface CbmVariant {
  /** Program base / link-pointer origin, e.g. C64 $0801, PET $0401. */
  progStart: number;
  /** Keyword table sorted longest-spelling first, for greedy matching. */
  keywordsByLength: C64Keyword[];
}

/** Program base on the C64; other machines override it via {@link CbmVariant}. */
const DEFAULT_PROG_START = PROGRAM_BASE;
/** Highest line number Commodore BASIC accepts. */
const MAX_LINE = 63999;

/** Longest keyword whose spelling matches the source at `pos`, or undefined. */
function matchKeyword(
  source: string,
  pos: number,
  keywordsByLength: C64Keyword[],
): C64Keyword | undefined {
  for (const kw of keywordsByLength) {
    const slice = source.substr(pos, kw.word.length);
    // Letters fold to upper case so lower-case keywords tokenize too; the
    // special glyphs (↑, π) and operators are unaffected by toUpperCase.
    if (slice.toUpperCase() === kw.word) return kw;
  }
  return undefined;
}

/**
 * The variant's keywords in the ROM's reserved-word order, for resolving
 * abbreviations.
 *
 * A Commodore token is the word's index in the ROM's reserved-word table plus
 * $80, so ascending token value *is* the order the ROM's scan walks the table -
 * which is what makes `goT` resolve to GOTO and `pO` to POKE rather than POS,
 * and what leaves PRINT and INPUT unabbreviable behind PRINT# and INPUT#
 * (hence `?`). Alias spellings (`?`, `^`) and the non-alphabetic entries
 * (the operators, π) are left out: an abbreviation is a prefix of a spelled
 * word, and those have no prefix to shorten.
 *
 * Cached per keyword table so each variant sorts once.
 */
const tokenOrderCache = new WeakMap<C64Keyword[], C64Keyword[]>();

function keywordsInTokenOrder(keywordsByLength: C64Keyword[]): C64Keyword[] {
  let order = tokenOrderCache.get(keywordsByLength);
  if (!order) {
    order = keywordsByLength
      .filter((kw) => kw.alias !== true && /^[A-Z]/.test(kw.word))
      .sort((a, b) => a.token - b.token);
    tokenOrderCache.set(keywordsByLength, order);
  }
  return order;
}

/** `{shift-x}`: the escape spelling of the shifted letter ending an abbreviation. */
const SHIFT_ESCAPE = /^\{shift-([a-z])\}/i;
const LOWER = /[a-z]/;

/**
 * A shifted-letter abbreviation at `pos`, or undefined.
 *
 * On the real machines a keyword may be entered as a prefix whose last letter
 * is *shifted*: the ROM's cruncher compares its reserved-word table character
 * by character and accepts the word as soon as a shifted letter matches, so
 * `pO` enters POKE and `gosU` GOSUB. Archive listings are printed in that
 * notation throughout.
 *
 * IDE source is plain text, so the shift is written either as an upper-case
 * letter following lower-case ones or as the `{shift-x}` escape. Requiring a
 * lower-case prefix is what keeps a program spelled in capitals from being
 * re-read as something shorter; the caller then prefers the case-blind full
 * spelling wherever it reaches at least as far, so a keyword written out in
 * any mix of case still tokenizes as itself.
 */
function matchAbbreviation(
  source: string,
  pos: number,
  keywordsByLength: C64Keyword[],
): { keyword: C64Keyword; length: number } | undefined {
  let i = pos;
  while (i < source.length && LOWER.test(source[i]!)) i++;
  if (i === pos) return undefined;

  const rest = source.slice(i);
  const escape = SHIFT_ESCAPE.exec(rest);
  const shifted = escape ? escape[1]! : /^[A-Z]/.test(rest) ? rest[0]! : '';
  if (shifted === '') return undefined;

  const prefix = (source.slice(pos, i) + shifted).toUpperCase();
  const keyword = keywordsInTokenOrder(keywordsByLength).find((kw) =>
    kw.word.startsWith(prefix),
  );
  if (!keyword) return undefined;
  return { keyword, length: i - pos + (escape ? escape[0].length : 1) };
}

/**
 * Tokenize one line body (everything after the line number) into program bytes.
 * The C64 ROM tokenizes greedily and position-independently, so we match the
 * longest keyword at each point; quotes, REM and DATA suspend tokenizing.
 */
const IDENT_HEAD = /[A-Za-z]/;
const IDENT_TAIL = /[A-Za-z0-9]/;

function tokenizeBody(
  body: string,
  editorLine: number,
  bodyCol: number,
  errors: TokenizeError[],
  keywordsByLength: C64Keyword[],
): number[] {
  const out: number[] = [];
  let pos = 0;
  let inString = false;
  let remRest = false; // REM: copy the rest of the line verbatim
  let dataMode = false; // DATA: verbatim until an unquoted ':'
  let stmtStart = true; // at a statement opener (line start, ':', after THEN)
  let lineNoOk = false; // digits open a statement only right after THEN

  // Consume one PETSCII unit (a `{...}` escape or a single character) at `at`,
  // push its code, and return how many source characters it spanned. Unmappable
  // input is recorded as a lint error and skipped one character at a time.
  const pushUnit = (at: number): number => {
    try {
      const { code, length } = parseC64Char(body, at);
      out.push(code);
      return length;
    } catch (e) {
      if (e instanceof CharsetError) {
        errors.push({
          line: editorLine,
          column: bodyCol + at,
          message: e.message,
        });
        return 1;
      }
      throw e;
    }
  };

  // A statement opener the ROM would reject at RUN time with ?SYNTAX ERROR.
  // Recorded as a lint error; tokenization continues unchanged so the byte
  // stream stays ROM-identical for every input.
  const flagStatement = (at: number, end: number, got: string): void => {
    errors.push({
      line: editorLine,
      column: bodyCol + at,
      endColumn: bodyCol + end,
      message: `Statement must start with a BASIC command or assignment (got '${got}')`,
      // Heuristic only: the ROM stores these bytes and would ?SYNTAX ERROR at
      // RUN, not at entry. Non-fatal so an imported program that trips the
      // heuristic still builds a runnable, re-exportable image
      // (lint/buildability split).
      fatal: false,
    });
  };

  // True when the name at `at` opens an assignment: A=…, A$=…, A(3)=….
  const isAssignmentStart = (at: number): boolean => {
    let j = at;
    while (j < body.length && IDENT_TAIL.test(body[j]!)) j++;
    if (j < body.length && '$%'.includes(body[j]!)) j++;
    while (body[j] === ' ') j++;
    return body[j] === '=' || body[j] === '(';
  };

  while (pos < body.length) {
    const ch = body[pos]!;

    if (remRest) {
      pos += pushUnit(pos);
      continue;
    }
    if (inString) {
      if (ch === '"') {
        out.push(0x22);
        inString = false;
        pos++;
      } else {
        pos += pushUnit(pos);
      }
      continue;
    }
    if (ch === '"') {
      if (stmtStart) {
        flagStatement(pos, pos + 1, '"');
        stmtStart = false;
      }
      out.push(0x22);
      inString = true;
      pos++;
      continue;
    }
    if (dataMode) {
      if (ch === ':') {
        out.push(0x3a);
        dataMode = false;
        stmtStart = true;
        lineNoOk = false;
        pos++;
      } else {
        pos += pushUnit(pos);
      }
      continue;
    }

    // Spaces never end a statement opener; ':' begins a new statement.
    if (ch === ' ') {
      pos += pushUnit(pos);
      continue;
    }
    if (ch === ':') {
      out.push(0x3a);
      stmtStart = true;
      lineNoOk = false;
      pos++;
      continue;
    }

    const kw = matchKeyword(body, pos, keywordsByLength);
    const full = kw ? { keyword: kw, length: kw.word.length } : undefined;
    const short = matchAbbreviation(body, pos, keywordsByLength);
    // The longer reading wins, and a tie goes to the full spelling: a keyword
    // written out in full always tokenizes as itself, whatever its case, while
    // an abbreviation that reaches further still resolves - `goS` is GOSUB
    // rather than GO followed by a variable, as it is on the machine.
    const hit = full && (!short || short.length <= full.length) ? full : short;
    if (hit) {
      const { keyword, length } = hit;
      if (stmtStart && keyword.kind !== 'command') {
        // The source spelling rather than the resolved word, so an abbreviation
        // is reported as the reader typed it.
        flagStatement(pos, pos + length, body.slice(pos, pos + length));
      }
      out.push(keyword.token);
      pos += length;
      stmtStart = keyword.word === 'THEN';
      lineNoOk = stmtStart;
      if (keyword.verbatimRest === 'line') remRest = true;
      else if (keyword.verbatimRest === 'statement') dataMode = true;
      continue;
    }

    if (stmtStart) {
      if (/[0-9]/.test(ch)) {
        // A line number is a valid statement only right after THEN.
        if (!lineNoOk) flagStatement(pos, pos + 1, ch);
      } else if (IDENT_HEAD.test(ch)) {
        if (!isAssignmentStart(pos)) {
          let j = pos + 1;
          while (j < body.length && IDENT_TAIL.test(body[j]!)) j++;
          flagStatement(pos, j, body.slice(pos, j));
        }
      } else {
        flagStatement(pos, pos + 1, ch);
      }
      stmtStart = false;
    }

    pos += pushUnit(pos);
  }

  return out;
}

interface LineRecord {
  lineNo: number;
  body: number[];
}

export function tokenizeProgram(
  source: string,
  variant?: CbmVariant,
): TokenizedProgram {
  const progStart = variant?.progStart ?? DEFAULT_PROG_START;
  const keywordsByLength = variant?.keywordsByLength ?? c64KeywordsByLength;
  const errors: TokenizeError[] = [];
  const records: LineRecord[] = [];
  let prevLineNo = -1;

  const lines = source.split('\n');
  for (let li = 0; li < lines.length; li++) {
    let raw = lines[li]!;
    if (raw.endsWith('\r')) raw = raw.slice(0, -1);
    if (raw.trim() === '') continue;
    const editorLine = li + 1;

    const m = /^(\s*)(\d+)(.*)$/.exec(raw);
    if (!m) {
      errors.push({
        line: editorLine,
        column: 0,
        message: 'Missing line number',
      });
      continue;
    }
    const lineNo = parseInt(m[2]!, 10);
    if (lineNo > 0xffff) {
      // A line number is a 16-bit field: anything past 65535 cannot be stored,
      // so this stays fatal and the line is dropped from the image.
      errors.push({
        line: editorLine,
        column: m[1]!.length,
        message: `Line number ${lineNo} exceeds the 16-bit maximum (65535)`,
      });
      continue;
    }
    if (lineNo > MAX_LINE) {
      // Commodore BASIC rejects entry above 63999, but a tokenized program on
      // tape/disk can hold such a line and still LIST/RUN. Warn, but keep the
      // line so an imported program stays runnable and re-exportable.
      errors.push({
        line: editorLine,
        column: m[1]!.length,
        message: `Line number ${lineNo} is above the ${MAX_LINE} Commodore BASIC accepts at entry`,
        fatal: false,
      });
    }
    if (lineNo <= prevLineNo) {
      errors.push({
        line: editorLine,
        column: m[1]!.length,
        message: `Line number ${lineNo} is not greater than the previous (${prevLineNo})`,
        fatal: false,
      });
    }
    prevLineNo = lineNo;

    // Skip the spaces between the line number and the first token; they are not
    // stored (LIST re-inserts one). Spaces within the body are kept.
    const afterNumber = m[1]!.length + m[2]!.length;
    const rest = m[3]!;
    const lead = rest.length - rest.trimStart().length;
    const body = rest.slice(lead);
    const bodyCol = afterNumber + lead;

    records.push({
      lineNo,
      body: tokenizeBody(body, editorLine, bodyCol, errors, keywordsByLength),
    });
  }

  // Assemble the linked-line layout with absolute next-line pointers.
  const prog: number[] = [];
  let addr = progStart;
  for (const { lineNo, body } of records) {
    const recLen = 2 + 2 + body.length + 1;
    const next = addr + recLen;
    prog.push(next & 0xff, (next >> 8) & 0xff);
    prog.push(lineNo & 0xff, (lineNo >> 8) & 0xff);
    prog.push(...body, 0x00);
    addr = next;
  }
  prog.push(0x00, 0x00); // null link terminates the program

  return { program: Uint8Array.from(prog), errors };
}
