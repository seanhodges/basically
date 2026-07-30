import { CharsetError, type TokenizeError } from '../types';
import { trs80Charset, parseChar } from './charset';
import { trs80KeywordsByLength, type Trs80Keyword } from './keywords';
import { PROG_START } from './addresses';

export interface TokenizedProgram {
  /**
   * The tokenized program as it sits in memory from 0x42E9 (TXTTAB): for each
   * line a 2-byte absolute link to the next line, the 2-byte little-endian line
   * number, the tokenized body and a 0x00 terminator, ending with a 0x0000 null
   * link. Mirrors the C64 layout (see commodore64/tokenizer.ts) but based at
   * 0x42E9 with the Level II token table.
   */
  program: Uint8Array;
  errors: TokenizeError[];
}

/** Highest line number Level II BASIC accepts. */
const MAX_LINE = 65529;

/** TRS-80 code for one editor character, or undefined if unmappable. */
function toCode(ch: string): number | undefined {
  try {
    return trs80Charset.toMachine(ch)[0];
  } catch (e) {
    if (e instanceof CharsetError) return undefined;
    throw e;
  }
}

/** Longest keyword (or alias) whose spelling matches the source at `pos`. */
function matchKeyword(source: string, pos: number): Trs80Keyword | undefined {
  for (const kw of trs80KeywordsByLength) {
    const slice = source.substr(pos, kw.word.length);
    // Letters fold to upper case so lower-case keywords tokenize too; the
    // symbolic operators and the ↑/?/' synonyms are unaffected by toUpperCase.
    if (slice.toUpperCase() === kw.word) return kw;
  }
  return undefined;
}

/**
 * Tokenize one line body (everything after the line number) into program bytes.
 * Level II BASIC, like every Microsoft BASIC, tokenizes greedily and
 * position-independently - `FORI=1TO5` becomes FOR I =1 TO 5 - so we match the
 * longest keyword at each point. Quotes, REM (and its `'` synonym) and DATA
 * suspend tokenizing. `:` separates statements but is otherwise an ordinary
 * character, so multi-statement lines need no special handling.
 */
const IDENT_HEAD = /[A-Za-z]/;
const IDENT_TAIL = /[A-Za-z0-9]/;

function tokenizeBody(
  body: string,
  editorLine: number,
  bodyCol: number,
  errors: TokenizeError[],
): number[] {
  const out: number[] = [];
  let pos = 0;
  let inString = false;
  let remRest = false; // REM / ': copy the rest of the line verbatim
  let dataMode = false; // DATA: verbatim until an unquoted ':'
  let stmtStart = true; // at a statement opener (line start, ':', after THEN)
  let lineNoOk = false; // digits open a statement only right after THEN/ELSE

  const pushChar = (ch: string, col: number): void => {
    const code = toCode(ch);
    if (code === undefined) {
      errors.push({
        line: editorLine,
        column: col,
        message: `Character ${JSON.stringify(ch)} has no TRS-80 equivalent`,
      });
      return;
    }
    out.push(code);
  };

  // Emit one literal unit - a character, a graphics glyph or a `{0xNN}` escape -
  // inside a string / REM / DATA body. Returns the number of source code units
  // consumed; on an unmappable character it records an error and advances one.
  const emitLiteral = (at: number): number => {
    try {
      const { code, length } = parseChar(body, at);
      out.push(code);
      return length;
    } catch (e) {
      if (e instanceof CharsetError) {
        errors.push({
          line: editorLine,
          column: bodyCol + at,
          message: e.message,
        });
        return String.fromCodePoint(body.codePointAt(at)!).length;
      }
      throw e;
    }
  };

  // A statement opener the ROM would reject at RUN time with ?SN ERROR.
  // Recorded as a non-fatal lint error (the ROM stores such lines verbatim and
  // only errors at RUN); tokenization continues unchanged so the byte stream
  // stays ROM-identical for every input and the image stays buildable.
  const flagStatement = (at: number, end: number, got: string): void => {
    errors.push({
      line: editorLine,
      column: bodyCol + at,
      endColumn: bodyCol + end,
      message: `Statement must start with a BASIC command or assignment (got '${got}')`,
      fatal: false,
    });
  };

  // True when the name at `at` opens an assignment: A=…, A$=…, A(3)=….
  const isAssignmentStart = (at: number): boolean => {
    let j = at;
    while (j < body.length && IDENT_TAIL.test(body[j]!)) j++;
    if (j < body.length && '$%!#'.includes(body[j]!)) j++;
    while (body[j] === ' ') j++;
    return body[j] === '=' || body[j] === '(';
  };

  while (pos < body.length) {
    const col = bodyCol + pos;
    // One character may be an astral block-graphics sextant (a surrogate pair),
    // so read by code point and advance by its UTF-16 length.
    const ch = String.fromCodePoint(body.codePointAt(pos)!);

    if (remRest) {
      pos += emitLiteral(pos);
      continue;
    }
    if (inString) {
      if (ch === '"') {
        out.push(0x22);
        inString = false;
        pos += ch.length;
      } else {
        pos += emitLiteral(pos);
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
      pos += ch.length;
      continue;
    }
    if (dataMode) {
      if (ch === ':') {
        out.push(0x3a);
        dataMode = false;
        stmtStart = true;
        lineNoOk = false;
        pos += ch.length;
      } else {
        pos += emitLiteral(pos);
      }
      continue;
    }

    // Spaces never end a statement opener; ':' begins a new statement.
    if (ch === ' ') {
      pushChar(ch, col);
      pos += ch.length;
      continue;
    }
    if (ch === ':') {
      out.push(0x3a);
      stmtStart = true;
      lineNoOk = false;
      pos += ch.length;
      continue;
    }

    const kw = matchKeyword(body, pos);
    if (kw) {
      if (stmtStart && kw.kind !== 'command') {
        flagStatement(pos, pos + kw.word.length, kw.word);
      }
      // Two keywords store an implicit leading ':' that LIST hides: `'` is
      // `:REM'` (3A 93 FB) and ELSE is `:ELSE` (3A 95). Emitting the genuine
      // ROM form keeps CSAVE/.cas exports byte-identical to real hardware.
      if (kw.word === "'") out.push(0x3a, 0x93, 0xfb);
      else if (kw.word === 'ELSE') out.push(0x3a, 0x95);
      else out.push(kw.token);
      pos += kw.word.length;
      stmtStart = kw.word === 'THEN' || kw.word === 'ELSE';
      lineNoOk = stmtStart;
      if (kw.verbatimRest === 'line') remRest = true;
      else if (kw.verbatimRest === 'statement') dataMode = true;
      continue;
    }

    if (stmtStart) {
      if (/[0-9]/.test(ch)) {
        // A line number is a valid statement only right after THEN/ELSE.
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

    pushChar(ch, col);
    pos += ch.length;
  }

  return out;
}

interface LineRecord {
  lineNo: number;
  body: number[];
}

export function tokenizeProgram(source: string): TokenizedProgram {
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
    if (lineNo > MAX_LINE) {
      errors.push({
        line: editorLine,
        column: m[1]!.length,
        message: `Line number ${lineNo} out of range 0–${MAX_LINE}`,
      });
      continue;
    }
    if (lineNo <= prevLineNo) {
      // Non-fatal: the line is still stored, so the image stays complete and
      // buildable (matching the C64's treatment of ordering lint).
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
      body: tokenizeBody(body, editorLine, bodyCol, errors),
    });
  }

  // Assemble the linked-line layout with absolute next-line pointers from 0x42E9.
  const prog: number[] = [];
  let addr = PROG_START;
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
