import { CharsetError, type TokenizeError } from '../types';
import {
  parseChar,
  samcoupeCharset,
  ENTER,
  NUMBER_MARKER,
  QUOTE,
} from './charset';
import {
  BIN_TOKEN,
  COMMAND_FIRST,
  DEF_FN_TOKEN,
  FUNCTION_LEADER,
  LONG_ELSE,
  LONG_IF,
  REM_TOKEN,
  SHORT_ELSE,
  SHORT_IF,
  THEN_TOKEN,
  keywordAliases,
  samcoupeKeywords,
} from './keywords';
import { encodeSamNumber } from './numbers';

export interface TokenizedProgram {
  /** Tokenized program area (concatenated lines), as stored from PROG. */
  bytes: Uint8Array;
  errors: TokenizeError[];
}

/** Highest line number the ROM will store: `LD HL,&FEFF` in miscx1.asm. */
export const MAX_LINE_NUMBER = 0xfeff;
/** Longest line body the ROM will insert, from INSERTLN's `CP &3F` on H. */
export const MAX_LINE_BYTES = 0x3eff;

/** Characters that continue a variable name, so a keyword cannot start here. */
const NAME_CHAR = /[A-Za-z0-9_$]/;
/**
 * Characters the ROM's `ALDU` rejects after a matched keyword: a letter, `$` or
 * `_`. Digits are absent from that test, which is why `PRINT1` really is PRINT
 * followed by 1 on this machine.
 */
const AFTER_KEYWORD = /[A-Za-z$_]/;

interface Matcher {
  /** Spelling to look for, upper case; a space in it is optional in the input. */
  word: string;
  /** Bytes this spelling stores. */
  bytes: number[];
  /** True for the entries that may open a statement. */
  command: boolean;
}

/**
 * The matchers, in the ROM's own table order.
 *
 * The ROM walks its list from the top and takes the first entry that matches
 * with a legal character after it, so the order decides what LOOP IF, ON ERROR
 * and DEF PROC mean. Aliases go last because the one alias the machine has -
 * INK for PEN - sits at the end of the ROM's list too.
 */
const matchers: Matcher[] = (() => {
  const byWord = new Map(samcoupeKeywords.map((k) => [k.word, k]));
  const tokenBytes = (token: number): number[] =>
    token < COMMAND_FIRST ? [FUNCTION_LEADER, token] : [token];
  const list: Matcher[] = samcoupeKeywords.map((k) => ({
    word: k.word,
    bytes: tokenBytes(k.token),
    command: k.kind === 'command',
  }));
  for (const [alias, canonical] of Object.entries(keywordAliases)) {
    const target = byWord.get(canonical)!;
    list.push({
      word: alias,
      bytes: tokenBytes(target.token),
      command: target.kind === 'command',
    });
  }
  return list;
})();

/**
 * Match `word` at position i of upper-cased `text`, returning the characters
 * consumed or -1. A space in the keyword is optional in the input - the ROM's
 * GTTOK3 skips its own list pointer when the input has no space there - so
 * GOTO, DEFPROC and ENDIF are the same keywords as GO TO, DEF PROC and END IF.
 */
function matchKeywordAt(text: string, i: number, word: string): number {
  let si = i;
  for (const wc of word) {
    if (wc === ' ') {
      if (text[si] === ' ') si++;
      continue;
    }
    if (text[si] !== wc) return -1;
    si++;
  }
  return si - i;
}

/**
 * Tokenize plain-text SAM BASIC into the program-area byte layout: per line, a
 * u16 big-endian line number, a u16 little-endian length (body plus its 0x0D)
 * and the tokenized body. `INSERTLN` in the ROM's mainlp.asm writes exactly
 * that, and a 0xFF where a line number's high byte would be ends the program.
 */
export function tokenizeProgram(source: string): TokenizedProgram {
  const out: number[] = [];
  const errors: TokenizeError[] = [];
  let prevLineNo = -1;

  const lines = source.split('\n');
  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li]!;
    const text = raw.trim();
    if (text === '') continue;
    const editorLine = li + 1;
    // Columns are offsets into the physical editor line, but everything below
    // is measured against the trimmed text, so every column owes the indent.
    const lead = raw.length - raw.trimStart().length;

    const m = /^(\d+)\s?/.exec(text);
    if (!m) {
      errors.push({
        line: editorLine,
        column: lead,
        message: 'Missing line number',
      });
      continue;
    }
    const lineNo = parseInt(m[1]!, 10);
    if (lineNo < 1 || lineNo > MAX_LINE_NUMBER) {
      errors.push({
        line: editorLine,
        column: lead,
        message: `Line number ${lineNo} out of range 1-${MAX_LINE_NUMBER}`,
      });
      continue;
    }
    if (lineNo <= prevLineNo) {
      errors.push({
        line: editorLine,
        column: lead,
        message: `Line number ${lineNo} not greater than previous line ${prevLineNo}`,
      });
      continue;
    }

    const body = tokenizeBody(
      text.slice(m[0].length),
      editorLine,
      lead + m[0].length,
      errors,
    );
    if (body === null) continue;
    if (body.length + 1 > MAX_LINE_BYTES) {
      errors.push({
        line: editorLine,
        column: lead,
        message: `Line is ${body.length + 1} bytes; the ROM stores at most ${MAX_LINE_BYTES}`,
      });
      continue;
    }

    prevLineNo = lineNo;
    out.push((lineNo >> 8) & 0xff, lineNo & 0xff);
    const len = body.length + 1;
    out.push(len & 0xff, (len >> 8) & 0xff);
    out.push(...body, ENTER);
  }

  return { bytes: Uint8Array.from(out), errors };
}

function tokenizeBody(
  body: string,
  editorLine: number,
  colOffset: number,
  errors: TokenizeError[],
): number[] | null {
  const out: number[] = [];
  const upper = body.toUpperCase();
  let i = 0;
  let prevSignificant = '';
  let statementStart = true;
  // Index in `out` of an IF token still waiting to learn whether a THEN turns
  // it into the single-line form, and whether the last IF on this line did.
  // `LINESCAN` clears the ROM's IFTYPE at the head of every line, so both
  // start over per line.
  let pendingIf: number | null = null;
  let ifShort = false;

  const fail = (message: string, at: number): null => {
    errors.push({ line: editorLine, column: colOffset + at, message });
    return null;
  };

  /**
   * A statement that does not open the way the ROM requires. Non-fatal: the
   * bytes are unambiguous, so the squiggle does not block a runnable image.
   */
  const flagStatement = (
    at: number,
    end: number,
    got: string,
    hint = '',
  ): void => {
    errors.push({
      line: editorLine,
      column: colOffset + at,
      endColumn: colOffset + end,
      message: `Statement must start with a command keyword or a procedure name (got ${got})${hint}`,
      fatal: false,
    });
  };

  const emitParsed = (at: number): number => {
    try {
      const { codes, length } = parseChar(body, at);
      out.push(...codes);
      return length;
    } catch (e) {
      if (e instanceof CharsetError) {
        fail(e.message, e.index);
        return -1;
      }
      throw e;
    }
  };

  while (i < body.length) {
    const ch = body[i]!;

    if (ch === ' ' || ch === '\t') {
      // Spaces are stored as typed; only the one either side of a keyword is
      // eaten, which is what the ROM's TOK43/TOK6 do.
      out.push(0x20);
      prevSignificant = ' ';
      i++;
      continue;
    }

    if (ch === ':') {
      out.push(0x3a);
      statementStart = true;
      pendingIf = null;
      prevSignificant = ':';
      i++;
      continue;
    }

    if (ch === '"') {
      if (statementStart) flagStatement(i, i + 1, '"');
      statementStart = false;
      out.push(QUOTE);
      i++;
      let closed = false;
      while (i < body.length) {
        if (body[i] === '"') {
          out.push(QUOTE);
          i++;
          closed = true;
          break;
        }
        const consumed = emitParsed(i);
        if (consumed < 0) return null;
        i += consumed;
      }
      if (!closed) return fail('Unterminated string', body.length - 1);
      prevSignificant = '"';
      continue;
    }

    // Keywords. A name character before this position rules one out, the way
    // the ROM's scan skips the rest of a word it could not match.
    let matched = false;
    if (!NAME_CHAR.test(prevSignificant)) {
      for (const kw of matchers) {
        const consumed = matchKeywordAt(upper, i, kw.word);
        if (consumed < 0) continue;
        const next = body[i + consumed];
        if (next !== undefined && AFTER_KEYWORD.test(next)) continue;

        if (statementStart && !kw.command)
          flagStatement(i, i + consumed, kw.word);

        // A keyword swallows one space either side of itself.
        if (out[out.length - 1] === 0x20) out.pop();
        const at = out.length;
        out.push(...kw.bytes);
        i += consumed;
        if (body[i] === ' ') i++;
        prevSignificant = ' ';
        matched = true;

        const token = kw.bytes[kw.bytes.length - 1]!;
        if (token === LONG_IF && kw.bytes.length === 1) {
          pendingIf = at;
        } else if (token === THEN_TOKEN && pendingIf !== null) {
          out[pendingIf] = SHORT_IF;
          pendingIf = null;
          ifShort = true;
        } else if (token === LONG_ELSE) {
          if (ifShort) out[at] = SHORT_ELSE;
        }
        // THEN and ELSE each introduce a fresh statement.
        statementStart = token === THEN_TOKEN || token === LONG_ELSE;

        if (token === REM_TOKEN) {
          if (!emitRest(out, body, i, fail)) return null;
          i = body.length;
        } else if (token === BIN_TOKEN) {
          i = emitBin(out, upper, i);
          prevSignificant = '0';
        } else if (token === DEF_FN_TOKEN) {
          i = emitDefFnParams(out, body, i);
          prevSignificant = ')';
        }
        break;
      }
    }
    if (matched) continue;

    // Anything else opening a statement. A bare name is legal - it calls a
    // DEF PROC - so only a non-letter is wrong here.
    if (statementStart) {
      if (/[A-Za-z]/.test(ch)) {
        let j = i;
        while (j < body.length && NAME_CHAR.test(body[j]!)) j++;
        let k = j;
        while (body[k] === ' ') k++;
        if (body[k] === '=' && body[k + 1] !== '=') {
          flagStatement(
            i,
            j,
            body.slice(i, j),
            ' - SAM BASIC needs LET to assign',
          );
        }
      } else if (/[0-9.]/.test(ch)) {
        const numMatch = /^(\d+(\.\d*)?|\.\d+)(E[+-]?\d+)?/.exec(
          upper.slice(i),
        );
        const len = numMatch && numMatch[0] !== '.' ? numMatch[0].length : 1;
        flagStatement(i, i + len, body.slice(i, i + len));
      } else {
        flagStatement(i, i + 1, ch);
      }
      statementStart = false;
    }

    // A hexadecimal literal: '&' then hex digits, with the same hidden
    // five-byte value a decimal literal carries (CALC5BY -> AMPERSAND).
    if (ch === '&' && /^[0-9A-F]/.test(upper.slice(i + 1, i + 2))) {
      const digits = /^[0-9A-F]+/.exec(upper.slice(i + 1))![0];
      const value = parseInt(digits, 16);
      out.push(0x26);
      for (const c of body.slice(i + 1, i + 1 + digits.length))
        out.push(c.charCodeAt(0));
      out.push(NUMBER_MARKER);
      try {
        out.push(...encodeSamNumber(value));
      } catch {
        return fail(`Number out of range: &${digits}`, i);
      }
      i += 1 + digits.length;
      prevSignificant = '0';
      continue;
    }

    // Numeric literal not continuing an identifier.
    if (/[0-9.]/.test(ch) && !NAME_CHAR.test(prevSignificant)) {
      const numMatch = /^(\d+(\.\d*)?|\.\d+)(E[+-]?\d+)?/.exec(upper.slice(i));
      if (numMatch && numMatch[0] !== '.') {
        const numText = numMatch[0];
        for (const c of numText) out.push(c.charCodeAt(0));
        out.push(NUMBER_MARKER);
        try {
          out.push(...encodeSamNumber(parseFloat(numText)));
        } catch {
          return fail(`Number out of range: ${numText}`, i);
        }
        i += numText.length;
        prevSignificant = '0';
        continue;
      }
    }

    const unit = String.fromCodePoint(body.codePointAt(i)!);
    const consumed = emitParsed(i);
    if (consumed < 0) return null;
    prevSignificant = unit;
    i += consumed;
  }

  return out;
}

/** Emit the rest of the line verbatim (a REM body), honouring escapes. */
function emitRest(
  out: number[],
  body: string,
  start: number,
  fail: (m: string, at: number) => null,
): boolean {
  let j = start;
  while (j < body.length) {
    try {
      const { codes, length } = parseChar(body, j);
      out.push(...codes);
      j += length;
    } catch (e) {
      if (e instanceof CharsetError) {
        fail(e.message, e.index);
        return false;
      }
      throw e;
    }
  }
  return true;
}

/** Emit the binary digits after BIN plus the hidden value they stand for. */
function emitBin(out: number[], upper: string, start: number): number {
  const digits = /^[01]+/.exec(upper.slice(start));
  if (!digits) return start;
  for (const c of digits[0]) out.push(c.charCodeAt(0));
  out.push(NUMBER_MARKER, ...encodeSamNumber(parseInt(digits[0], 2)));
  return start + digits[0].length;
}

/**
 * Emit a DEF FN parameter list, reserving each parameter's hidden value slot.
 *
 * The ROM's DEF FN syntax pass calls MAKESIX after every parameter name, which
 * opens six bytes - the 0x0E marker and five zeros - for a later FN call to
 * store the argument in. A list without them stops with a parameter error, so
 * they are part of the stored line rather than something the caller builds.
 * Parameters are a single letter with an optional `$`, which is all GETALPH
 * accepts.
 */
function emitDefFnParams(out: number[], body: string, start: number): number {
  let i = start;
  while (i < body.length && body[i] === ' ') {
    out.push(0x20);
    i++;
  }
  // The function name, then the bracket that opens the list.
  while (i < body.length && NAME_CHAR.test(body[i]!)) {
    out.push(body.charCodeAt(i));
    i++;
  }
  if (body[i] !== '(') return i;
  out.push(0x28);
  i++;
  while (i < body.length && body[i] !== ')') {
    const ch = body[i]!;
    if (/[A-Za-z]/.test(ch)) {
      out.push(ch.charCodeAt(0));
      i++;
      if (body[i] === '$') {
        out.push(0x24);
        i++;
      }
      out.push(NUMBER_MARKER, 0, 0, 0, 0, 0);
      continue;
    }
    out.push(...samcoupeCharset.toMachine(ch));
    i++;
  }
  if (body[i] === ')') {
    out.push(0x29);
    i++;
  }
  return i;
}
