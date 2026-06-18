import { CharsetError, type TokenizeError } from '../types';
import { c64Charset } from './charset';
import { c64KeywordsByLength, type C64Keyword } from './keywords';

export interface TokenizedProgram {
  /**
   * The tokenized program as it sits in memory from $0801: for each line a
   * 2-byte link to the next line, the 2-byte line number, the tokenized body
   * and a 0x00 terminator, ending with a 0x0000 null link. Prepend the 2-byte
   * load address ($01 $08) to get a .prg image.
   */
  program: Uint8Array;
  errors: TokenizeError[];
}

/** Programs load at $0801 on the C64; link pointers are absolute addresses. */
const PROG_START = 0x0801;
/** Highest line number Commodore BASIC accepts. */
const MAX_LINE = 63999;

/** PETSCII code for one editor character, or undefined if unmappable. */
function petscii(ch: string): number | undefined {
  try {
    return c64Charset.toMachine(ch)[0];
  } catch (e) {
    if (e instanceof CharsetError) return undefined;
    throw e;
  }
}

/** Longest keyword whose spelling matches the source at `pos`, or undefined. */
function matchKeyword(source: string, pos: number): C64Keyword | undefined {
  for (const kw of c64KeywordsByLength) {
    const slice = source.substr(pos, kw.word.length);
    // Letters fold to upper case so lower-case keywords tokenize too; the
    // special glyphs (↑, π) and operators are unaffected by toUpperCase.
    if (slice.toUpperCase() === kw.word) return kw;
  }
  return undefined;
}

/**
 * Tokenize one line body (everything after the line number) into program bytes.
 * The C64 ROM tokenizes greedily and position-independently, so we match the
 * longest keyword at each point; quotes, REM and DATA suspend tokenizing.
 */
function tokenizeBody(
  body: string,
  editorLine: number,
  bodyCol: number,
  errors: TokenizeError[],
): number[] {
  const out: number[] = [];
  let pos = 0;
  let inString = false;
  let remRest = false; // REM: copy the rest of the line verbatim
  let dataMode = false; // DATA: verbatim until an unquoted ':'

  const pushChar = (ch: string, col: number): void => {
    const code = petscii(ch);
    if (code === undefined) {
      errors.push({
        line: editorLine,
        column: col,
        message: `Character ${JSON.stringify(ch)} has no Commodore 64 equivalent`,
      });
      return;
    }
    out.push(code);
  };

  while (pos < body.length) {
    const ch = body[pos]!;
    const col = bodyCol + pos;

    if (remRest) {
      pushChar(ch, col);
      pos++;
      continue;
    }
    if (inString) {
      if (ch === '"') {
        out.push(0x22);
        inString = false;
      } else {
        pushChar(ch, col);
      }
      pos++;
      continue;
    }
    if (ch === '"') {
      out.push(0x22);
      inString = true;
      pos++;
      continue;
    }
    if (dataMode) {
      if (ch === ':') {
        out.push(0x3a);
        dataMode = false;
      } else {
        pushChar(ch, col);
      }
      pos++;
      continue;
    }

    const kw = matchKeyword(body, pos);
    if (kw) {
      out.push(kw.token);
      pos += kw.word.length;
      if (kw.verbatimRest === 'line') remRest = true;
      else if (kw.verbatimRest === 'statement') dataMode = true;
      continue;
    }

    pushChar(ch, col);
    pos++;
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
      errors.push({
        line: editorLine,
        column: m[1]!.length,
        message: `Line number ${lineNo} is not greater than the previous (${prevLineNo})`,
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

  // Assemble the linked-line layout with absolute next-line pointers.
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
