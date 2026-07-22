import { CharsetError, type TokenizeError } from '../types';
import { cpcCharset, parseChar } from './charset';
import {
  SQ_STATEMENT_TOKEN,
  locoVariant,
  type LocoBasicVariant,
  type LocoKeyword,
  type LocoVariant,
} from './keywords';
import { encodeLocoFloat } from './numbers';

/**
 * Locomotive BASIC tokenizer: per line
 * `[u16 LE total length][u16 LE line number][tokens…][0x00]`, the program
 * terminated by a zero length word. Numeric constants are stored in binary
 * (`&0E-&18` small integers 0-10, `&19` byte, `&1A` 16-bit integer, `&1B`
 * binary, `&1C` hex, `&1E` line number, `&1F` 5-byte real); spaces are
 * stored verbatim (the CPC LISTs your own spacing back). Collects
 * TokenizeError[] (1-based line, 0-based column) instead of throwing;
 * statement-shape lint is non-fatal so imported programs stay runnable.
 */

/** Statement separator, end-of-line and the special mid-line tokens. */
const STATEMENT_SEP = 0x01;
const APOSTROPHE = 0xc0;
const ON = 0xb2;
const RSX = 0x7c;
const QUOTE = 0x22;

/** Variable-definition tokens, by type suffix ('' = unsuffixed real). */
const VAR_TOKEN: Record<string, number> = {
  '%': 0x02,
  $: 0x03,
  '!': 0x04,
  '': 0x0d,
};

/** Small-integer tokens: `&0E + n` encodes 0-10 in one byte. */
const SMALL_INT_BASE = 0x0e;
const BYTE_INT = 0x19;
const WORD_INT = 0x1a;
const BINARY_INT = 0x1b;
const HEX_INT = 0x1c;
const LINE_NUMBER = 0x1e;
const FLOAT = 0x1f;

/** Symbolic operator tokens (two-character forms first for greedy match). */
const OPERATORS_2: Record<string, number> = {
  '>=': 0xf0,
  '=>': 0xf0,
  '<=': 0xf3,
  '=<': 0xf3,
  '<>': 0xf2,
};
const OPERATORS_1: Record<string, number> = {
  '>': 0xee,
  '=': 0xef,
  '<': 0xf1,
  '+': 0xf4,
  '-': 0xf5,
  '*': 0xf6,
  '/': 0xf7,
  '^': 0xf8,
  '↑': 0xf8,
  '\\': 0xf9,
};

const LETTER = /[A-Za-z]/;
const ALNUM = /[A-Za-z0-9]/;
const WS = /[ \t]/;
const MAX_LINE = 65535;
/** Locomotive names are up to 40 characters, all significant. */
const MAX_NAME = 40;

export interface TokenizedProgram {
  /** Full tokenized program: line records plus the 0x0000 end marker. */
  bytes: Uint8Array;
  errors: TokenizeError[];
}

export function tokenizeProgram(
  source: string,
  variant: LocoBasicVariant = 'basic10',
): TokenizedProgram {
  const tables = locoVariant(variant);
  const out: number[] = [];
  const errors: TokenizeError[] = [];
  let prevLineNo = -1;

  const lines = source.split('\n');
  for (let li = 0; li < lines.length; li++) {
    let raw = lines[li]!;
    if (raw.endsWith('\r')) raw = raw.slice(0, -1);
    if (raw.trim() === '') continue;
    const editorLine = li + 1;

    const m = /^\s*(\d+) ?(.*)$/.exec(raw);
    if (!m) {
      errors.push({
        line: editorLine,
        column: 0,
        message: 'Missing line number',
      });
      continue;
    }
    const lineNo = parseInt(m[1]!, 10);
    if (lineNo < 1 || lineNo > MAX_LINE) {
      errors.push({
        line: editorLine,
        column: 0,
        message: `Line number ${lineNo} out of range 1-${MAX_LINE}`,
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

    const colOffset = raw.length - m[2]!.length;
    const body = tokenizeBody(m[2]!, editorLine, colOffset, errors, tables);
    if (body === null) continue; // error already recorded

    prevLineNo = lineNo;
    const len = body.length + 5; // length word + line number word + body + 0x00
    out.push(len & 0xff, (len >> 8) & 0xff);
    out.push(lineNo & 0xff, (lineNo >> 8) & 0xff);
    for (const b of body) out.push(b);
    out.push(0x00);
  }

  out.push(0x00, 0x00); // zero length word terminates the program
  return { bytes: Uint8Array.from(out), errors };
}

/** Match a (possibly multi-word) keyword at position i; -1 on no match. */
function matchKeywordAt(upper: string, i: number, word: string): number {
  let si = i;
  let wi = 0;
  while (wi < word.length) {
    const wc = word[wi]!;
    if (wc === ' ') {
      if (!WS.test(upper[si] ?? '')) return -1;
      while (WS.test(upper[si] ?? '')) si++;
      wi++;
    } else {
      if (upper[si] !== wc) return -1;
      si++;
      wi++;
    }
  }
  return si - i;
}

/** A resolved keyword and the source characters it consumes. */
interface KeywordMatch {
  kw: LocoKeyword;
  len: number;
}

/**
 * Longest keyword (or alias/phrase) starting at body[i]. A keyword ending in
 * a letter must not run into another letter or `$` - `SCORE` and `PRINTER`
 * stay variables - but a following digit is fine (`GOTO10`; `LOG10` itself
 * wins over `LOG` by length).
 */
function matchKeyword(
  body: string,
  upper: string,
  i: number,
  tables: LocoVariant,
): KeywordMatch | null {
  for (const { word, kw } of tables.matchersByLength) {
    // Symbolic operators and the apostrophe are matched by character instead.
    if (!LETTER.test(word[0]!)) continue;
    const len = matchKeywordAt(upper, i, word);
    if (len < 0) continue;
    const last = word[word.length - 1]!;
    if (LETTER.test(last) || /[0-9]/.test(last)) {
      const next = body[i + len];
      if (next !== undefined && (LETTER.test(next) || next === '$')) continue;
    }
    return { kw, len };
  }
  return null;
}

function tokenizeBody(
  body: string,
  editorLine: number,
  colOffset: number,
  errors: TokenizeError[],
  tables: LocoVariant,
): number[] | null {
  const out: number[] = [];
  const upper = body.toUpperCase();
  let i = 0;
  let statementStart = true;
  let lino = false;
  let afterOn = false;
  let failed = false;

  const error = (
    message: string,
    at: number,
    end?: number,
    fatal?: boolean,
  ): void => {
    errors.push({
      line: editorLine,
      column: colOffset + at,
      ...(end !== undefined ? { endColumn: colOffset + end } : {}),
      message,
      ...(fatal === false ? { fatal } : {}),
    });
    if (fatal !== false) failed = true;
  };

  // A statement opener the ROM would reject with Syntax error at RUN time.
  // Non-fatal: the line still stores and the program stays runnable.
  const flagStatement = (at: number, end: number, got: string): void => {
    error(
      `Statement must start with a command keyword or assignment (got '${got}')`,
      at,
      end,
      false,
    );
  };

  /** Emit one expression character through the charset; false on failure. */
  const emitChar = (ch: string, at: number): boolean => {
    try {
      for (const b of cpcCharset.toMachine(ch)) out.push(b);
      return true;
    } catch (e) {
      if (e instanceof CharsetError) {
        error(e.message, at);
        return false;
      }
      throw e;
    }
  };

  /**
   * Emit one literal unit (a character or `{0xNN}` escape) inside a string,
   * REM, apostrophe comment or DATA. Returns the next index, or null on an
   * unmappable character (already recorded).
   */
  const emitLiteral = (at: number): number | null => {
    try {
      const { codes, length } = parseChar(body, at);
      for (const b of codes) out.push(b);
      return at + length;
    } catch (e) {
      if (e instanceof CharsetError) {
        error(e.message, at);
        return null;
      }
      throw e;
    }
  };

  const emitLiteralToEnd = (from: number): boolean => {
    let j = from;
    while (j < body.length) {
      const next = emitLiteral(j);
      if (next === null) return false;
      j = next;
    }
    return true;
  };

  /** Copy a string literal starting at the opening quote; returns next i. */
  const emitString = (at: number): number | null => {
    out.push(QUOTE);
    let j = at + 1;
    while (j < body.length && body[j] !== '"') {
      const next = emitLiteral(j);
      if (next === null) return null;
      j = next;
    }
    if (j < body.length) {
      out.push(QUOTE);
      j++;
    }
    // An unterminated string is legal at end of line, as on the machine.
    return j;
  };

  /** Encode an integer constant in its smallest form. */
  const emitInt = (value: number): void => {
    if (value <= 10) {
      out.push(SMALL_INT_BASE + value);
    } else if (value <= 0xff) {
      out.push(BYTE_INT, value);
    } else {
      out.push(WORD_INT, value & 0xff, (value >> 8) & 0xff);
    }
  };

  const emitFloat = (value: number, at: number, end: number): boolean => {
    try {
      out.push(FLOAT, ...encodeLocoFloat(value));
      return true;
    } catch {
      error(`Number out of range: ${body.slice(at, end)}`, at, end);
      return false;
    }
  };

  while (i < body.length) {
    const ch = body[i]!;

    // Spaces are stored verbatim and leave all tokenizer state intact.
    if (ch === ' ' || ch === '\t') {
      out.push(0x20);
      i++;
      continue;
    }

    // Line-number mode: GOTO/GOSUB/THEN/… encode the following constants in
    // the &1E form. ',' (ON n GOTO a,b) and '-' (LIST 10-20) keep the mode.
    if (lino) {
      if (ch >= '0' && ch <= '9') {
        let j = i;
        while (j < body.length && body[j]! >= '0' && body[j]! <= '9') j++;
        const target = parseInt(body.slice(i, j), 10);
        if (target > MAX_LINE) {
          error(
            `Line-number target ${target} above ${MAX_LINE} cannot reference a real line`,
            i,
            j,
            false,
          );
        }
        out.push(LINE_NUMBER, target & 0xff, ((target & 0xffff) >> 8) & 0xff);
        i = j;
        statementStart = false;
        continue;
      }
      if (ch === ',') {
        out.push(0x2c);
        i++;
        continue;
      }
      if (ch === '-') {
        out.push(OPERATORS_1['-']!);
        i++;
        continue;
      }
      lino = false; // anything else ends line-number mode
    }

    // ':' separates statements (stored as the &01 token).
    if (ch === ':') {
      out.push(STATEMENT_SEP);
      i++;
      statementStart = true;
      continue;
    }

    // '?' is the PRINT shorthand; the ROM stores the PRINT token.
    if (ch === '?') {
      out.push(0xbf);
      i++;
      statementStart = false;
      continue;
    }

    // Apostrophe comment: an implicit new statement, rest of line literal.
    // Encoded as &01 &C0 mid-statement, bare &C0 opening one.
    if (ch === "'") {
      if (!statementStart) out.push(STATEMENT_SEP);
      out.push(APOSTROPHE);
      if (!emitLiteralToEnd(i + 1)) return null;
      i = body.length;
      continue;
    }

    // RSX command: '|' + offset byte (ROM-filled; 0 when tokenized) + name
    // with bit 7 set on its last character.
    if (ch === '|') {
      let j = i + 1;
      while (j < body.length && ALNUM.test(body[j]!)) j++;
      if (j === i + 1 || !LETTER.test(body[i + 1]!)) {
        error("Missing RSX name after '|'", i, i + 1);
        return null;
      }
      const name = upper.slice(i + 1, j);
      out.push(RSX, 0x00);
      for (let k = 0; k < name.length; k++) {
        out.push(name.charCodeAt(k) | (k === name.length - 1 ? 0x80 : 0));
      }
      i = j;
      statementStart = false;
      continue;
    }

    // String literal (nothing inside is tokenized; escapes carry raw bytes).
    if (ch === '"') {
      if (statementStart) flagStatement(i, i + 1, '"');
      const next = emitString(i);
      if (next === null) return null;
      i = next;
      statementStart = false;
      continue;
    }

    // '&' hex (&7F00 / &H7F00) and binary (&X101) integer literals.
    if (ch === '&') {
      const bin = /^&X([01]+)/i.exec(upper.slice(i));
      const hex = bin ? null : /^&H?([0-9A-F]+)/i.exec(upper.slice(i));
      const match = bin ?? hex;
      if (!match) {
        error("Malformed '&' number literal", i, i + 1);
        return null;
      }
      const value = parseInt(match[1]!, bin ? 2 : 16);
      if (value > 0xffff) {
        error(`Number out of range: ${body.slice(i, i + match[0].length)}`, i);
        return null;
      }
      out.push(bin ? BINARY_INT : HEX_INT, value & 0xff, (value >> 8) & 0xff);
      i += match[0].length;
      statementStart = false;
      continue;
    }

    // Keywords and variable names.
    if (LETTER.test(ch)) {
      const match = matchKeyword(body, upper, i, tables);
      // SQ is &B5 in ON SQ(n) GOSUB statement position, a function elsewhere.
      if (match && match.kw.word === 'SQ' && afterOn) {
        out.push(SQ_STATEMENT_TOKEN);
        i += match.len;
        afterOn = false;
        statementStart = false;
        continue;
      }
      if (match) {
        const { kw, len } = match;
        if (
          statementStart &&
          kw.kind !== 'command' &&
          kw.word !== 'MID$' // assignable: MID$(a$,p)="…"
        ) {
          flagStatement(i, i + len, kw.word);
        }
        out.push(...kw.bytes!);
        i += len;
        afterOn = kw.bytes![0] === ON;

        if (kw.word === 'REM') {
          if (!emitLiteralToEnd(i)) return null;
          i = body.length;
          statementStart = false;
          continue;
        }
        if (kw.word === 'DATA') {
          // DATA items are stored as literal text; a top-level ':' ends the
          // statement (quoted strings may contain one).
          while (i < body.length && body[i] !== ':') {
            if (body[i] === '"') {
              const next = emitString(i);
              if (next === null) return null;
              i = next;
              continue;
            }
            const next = emitLiteral(i);
            if (next === null) return null;
            i = next;
          }
          statementStart = false;
          continue;
        }
        lino = kw.lino === true;
        statementStart = kw.word === 'THEN' || kw.word === 'ELSE';
        continue;
      }

      // Not a keyword: a variable name (letters/digits + optional suffix).
      let j = i;
      while (j < body.length && ALNUM.test(body[j]!)) j++;
      let suffix = '';
      if (j < body.length && /[%$!]/.test(body[j]!)) {
        suffix = body[j]!;
        j++;
      }
      const name = body.slice(i, j - suffix.length);
      if (tables.missingWords.has(upper.slice(i, j))) {
        error(
          `${upper.slice(i, j)} is Locomotive BASIC 1.1 (CPC 664/6128) only - not available on the CPC 464`,
          i,
          j,
          false,
        );
      }
      if (name.length > MAX_NAME) {
        error(`Variable name longer than ${MAX_NAME} characters`, i, j, false);
      }
      if (statementStart) {
        let k = j;
        while (k < body.length && WS.test(body[k]!)) k++;
        const next = body[k];
        if (next !== '=' && next !== '(') {
          flagStatement(i, j, body.slice(i, j));
        }
      }
      out.push(VAR_TOKEN[suffix]!, 0x00, 0x00);
      for (let k = 0; k < name.length; k++) {
        out.push(name.charCodeAt(k) | (k === name.length - 1 ? 0x80 : 0));
      }
      i = j;
      statementStart = false;
      afterOn = false;
      continue;
    }

    // Numeric constants (digits handled here only when they don't continue a
    // variable name, which the identifier branch consumes itself).
    if (/[0-9.]/.test(ch)) {
      const num = /^(\d+(\.\d*)?|\.\d+)(E[+-]?\d+)?/i.exec(upper.slice(i));
      if (num && num[0] !== '.') {
        const text = num[0];
        const end = i + text.length;
        const isInt = !text.includes('.') && !/E/i.test(text);
        const value = parseFloat(text);
        if (isInt && value <= 0xffff) {
          emitInt(value);
        } else if (!emitFloat(value, i, end)) {
          return null;
        }
        if (statementStart) flagStatement(i, end, text);
        i = end;
        statementStart = false;
        continue;
      }
    }

    // Symbolic operators tokenize; other punctuation is stored as ASCII.
    const two =
      i + 1 < body.length ? OPERATORS_2[body.slice(i, i + 2)] : undefined;
    if (two !== undefined) {
      if (statementStart) flagStatement(i, i + 2, body.slice(i, i + 2));
      out.push(two);
      i += 2;
      statementStart = false;
      continue;
    }
    const one = OPERATORS_1[ch];
    if (one !== undefined) {
      if (statementStart) flagStatement(i, i + 1, ch);
      out.push(one);
      i++;
      statementStart = false;
      continue;
    }

    if (statementStart) flagStatement(i, i + 1, ch);
    if (!emitChar(ch, i)) return null;
    i++;
    statementStart = false;
  }

  return failed ? null : out;
}
