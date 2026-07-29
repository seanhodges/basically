import { CharsetError, type TokenizeError } from '../types';
import { bbcCharset, parseChar } from './charset';
import { BASIC_II, type BbcKeyword, type BbcVariant } from './keywords';
import { encodeLineNumber } from './lineNumber';

export interface TokenizedProgram {
  /** Full tokenized program: per-line records followed by the 0x0D 0xFF end. */
  bytes: Uint8Array;
  errors: TokenizeError[];
}

/** The 0x0D 0xFF that terminates a tokenized BBC BASIC program. */
const END_LO = 0x0d;
const END_HI = 0xff;

/** Highest line number BBC BASIC will store (0xFF00 is the end marker). */
const MAX_LINE = 65279;
/**
 * Highest line number the ROM's line editor accepts when a line is *typed*.
 * Higher numbers (up to {@link MAX_LINE}) exist in stored programs and RUN, so
 * they are a non-fatal lint - imported programs that use them still build.
 */
const ENTRY_MAX = 32767;
/** Max tokenized body bytes per line (line length byte is body + 4 ≤ 255). */
const MAX_BODY = 251;

const ALNUM = /[A-Za-z0-9_]/;
const LETTER = /[A-Za-z]/;
const HEX = /[0-9A-Fa-f]/;

/**
 * Tokenize plain-text BBC BASIC II into the in-memory program layout the BASIC
 * ROM uses (and that SAVE writes to disc): for each line `0x0D`, the line number
 * big-endian, a length byte (= body length + 4) and the tokenized body, with a
 * trailing `0x0D 0xFF`. The output is byte-for-byte what the genuine ROM
 * tokeniser produces (regression-tested in tokenizer.test.ts), so the emulator
 * can POKE it straight in at PAGE.
 */
export function tokenizeProgram(
  source: string,
  variant: BbcVariant = BASIC_II,
): TokenizedProgram {
  const out: number[] = [];
  const errors: TokenizeError[] = [];
  let prevLineNo = -1;
  // Inside a [ ... ] assembler block statement validation is suspended; the
  // block spans lines, so the flag lives here and threads through every body.
  const asm = { active: false };

  const lines = source.split('\n');
  for (let li = 0; li < lines.length; li++) {
    let raw = lines[li]!;
    if (raw.endsWith('\r')) raw = raw.slice(0, -1);
    if (raw.trim() === '') continue;
    const editorLine = li + 1;

    const m = /^(\d+)(.*)$/.exec(raw);
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
    if (lineNo > ENTRY_MAX) {
      // Storable and runnable, but the ROM line editor rejects it when typed.
      errors.push({
        line: editorLine,
        column: 0,
        message: `Line number ${lineNo} above ${ENTRY_MAX}; a real machine rejects it at the keyboard (it still runs once loaded)`,
        fatal: false,
      });
    }

    const colOffset = m[1]!.length;
    const body = tokenizeBody(
      m[2]!,
      editorLine,
      colOffset,
      errors,
      asm,
      variant,
    );
    if (body === null) continue; // error already recorded
    if (body.length > MAX_BODY) {
      errors.push({
        line: editorLine,
        column: 0,
        message: `Line too long (${body.length} > ${MAX_BODY} tokenized bytes)`,
      });
      continue;
    }

    prevLineNo = lineNo;
    out.push(0x0d, (lineNo >> 8) & 0xff, lineNo & 0xff, body.length + 4);
    for (const b of body) out.push(b);
  }

  out.push(END_LO, END_HI);
  return { bytes: Uint8Array.from(out), errors };
}

/** A resolved keyword (full or abbreviated) and the bytes it consumes. */
interface KeywordMatch {
  kw: BbcKeyword;
  token: number;
  len: number;
}

/** Match the longest keyword at body[i]; null if none applies here. */
function matchKeyword(
  body: string,
  i: number,
  statementStart: boolean,
  variant: BbcVariant,
): KeywordMatch | null {
  for (const kw of variant.keywordsByLength) {
    const len = kw.word.length;
    if (!body.startsWith(kw.word, i)) continue;
    // "Conditional" keywords ending in a letter are only tokenized when not
    // immediately followed by another name character (so TIMER stays a name).
    if (kw.conditional && LETTER.test(kw.word[len - 1]!)) {
      const next = body[i + len];
      if (next !== undefined && ALNUM.test(next)) continue;
    }
    const token =
      statementStart && kw.statementToken !== undefined
        ? kw.statementToken
        : kw.token;
    return { kw, token, len };
  }
  return null;
}

/**
 * Match a dot-abbreviation at body[i]: a run of (upper-case) keyword letters
 * immediately followed by '.', e.g. `P.` for PRINT or `GOS.` for GOSUB. The
 * ROM resolves it to the first keyword in {@link BbcVariant.abbreviations}
 * whose letters start with the typed prefix; the '.' is consumed. Returns null
 * when the text isn't a `letters.` shape or no keyword matches. Called only
 * after {@link matchKeyword} fails, so a fully-typed keyword is never treated
 * as an abbreviation.
 */
function matchAbbreviation(
  body: string,
  i: number,
  statementStart: boolean,
  variant: BbcVariant,
): KeywordMatch | null {
  let j = i;
  while (j < body.length && LETTER.test(body[j]!)) j++;
  if (j === i || body[j] !== '.') return null;
  const prefix = body.slice(i, j);
  const kw = variant.abbreviations.find((k) => k.word.startsWith(prefix));
  // No keyword has this prefix, or the prefix is a fully-typed keyword: leave
  // it to matchKeyword, which keeps the '.' as a literal (`AND.` is AND then
  // '.', whereas the proper abbreviation `ERR.` becomes ERROR).
  if (!kw || kw.word === prefix) return null;
  const token =
    statementStart && kw.statementToken !== undefined
      ? kw.statementToken
      : kw.token;
  return { kw, token, len: j - i + 1 }; // + 1 for the consumed '.'
}

function tokenizeBody(
  body: string,
  editorLine: number,
  colOffset: number,
  errors: TokenizeError[],
  asm: { active: boolean },
  variant: BbcVariant,
): number[] | null {
  const out: number[] = [];
  let i = 0;
  let statementStart = true;
  let lino = false;
  let failed = false;

  // A statement-start construct the ROM would reject at RUN time with Mistake/
  // Syntax error. Recorded as a lint error; tokenization continues unchanged so
  // the byte stream stays ROM-identical for every input.
  const flagStatement = (at: number, end: number, got: string): void => {
    errors.push({
      line: editorLine,
      column: colOffset + at,
      endColumn: colOffset + end,
      message: `Statement must start with a command keyword or assignment (got '${got}')`,
    });
  };

  const emit = (ch: string, at: number): boolean => {
    try {
      for (const b of bbcCharset.toMachine(ch)) out.push(b);
      return true;
    } catch (e) {
      if (e instanceof CharsetError) {
        errors.push({
          line: editorLine,
          column: colOffset + at,
          message: e.message,
        });
        failed = true;
        return false;
      }
      throw e;
    }
  };

  // Emit one literal unit (a character or a `{...}` escape) inside a string /
  // REM / DATA / `*` command. Returns the next index, or null on an unmappable
  // character (already recorded as an error).
  const emitLiteral = (at: number): number | null => {
    try {
      const { codes, length } = parseChar(body, at);
      for (const b of codes) out.push(b);
      return at + length;
    } catch (e) {
      if (e instanceof CharsetError) {
        errors.push({
          line: editorLine,
          column: colOffset + at,
          message: e.message,
        });
        failed = true;
        return null;
      }
      throw e;
    }
  };

  while (i < body.length) {
    // One character may be an astral mosaic sextant (a surrogate pair), so
    // read by code point and advance by its UTF-16 length.
    const ch = String.fromCodePoint(body.codePointAt(i)!);

    // Spaces are copied verbatim and leave statement/line-number state intact.
    if (ch === ' ' || ch === '\t') {
      out.push(ch.charCodeAt(0));
      i++;
      continue;
    }

    // Line-number mode: GOTO/THEN/… encode the following constants.
    if (lino) {
      if (ch >= '0' && ch <= '9') {
        let j = i;
        while (j < body.length && body[j]! >= '0' && body[j]! <= '9') j++;
        const target = parseInt(body.slice(i, j), 10);
        if (target > ENTRY_MAX) {
          // Targets above the entry limit wrap (& 0xFFFF) into a bogus line and
          // can never match a real one; flag it but keep tokenizing.
          errors.push({
            line: editorLine,
            column: colOffset + i,
            endColumn: colOffset + j,
            message: `Line-number target ${target} above ${ENTRY_MAX} cannot reference a real line`,
            fatal: false,
          });
        }
        out.push(...encodeLineNumber(target & 0xffff));
        i = j;
        statementStart = false;
        continue;
      }
      if (ch === ',') {
        out.push(0x2c);
        i++;
        continue; // a list of line numbers (ON … GOTO a,b,c)
      }
      lino = false; // anything else ends line-number mode
    }

    // '*' at the start of a statement: an OS command, rest of line is literal.
    if (statementStart && ch === '*') {
      while (i < body.length) {
        const next = emitLiteral(i);
        if (next === null) return null;
        i = next;
      }
      break;
    }

    // Keywords and variable names.
    if (LETTER.test(ch)) {
      // A trailing '.' always marks an abbreviation, even when the letters
      // spell a complete keyword (`ERR.` is ERROR, not ERR), so try it before
      // the full-keyword match.
      const match: KeywordMatch | null =
        matchAbbreviation(body, i, statementStart, variant) ??
        matchKeyword(body, i, statementStart, variant);
      if (match) {
        const { kw, token, len }: KeywordMatch = match;
        // Only command keywords and the assignable pseudo-variables (those
        // with a statement-position token, e.g. TIME=0) may open a statement.
        // BASIC IV additionally allows EXT#chan= (set a file's extent).
        if (
          statementStart &&
          !asm.active &&
          kw.kind !== 'command' &&
          kw.statementToken === undefined &&
          !(variant.extAsStatement && kw.word === 'EXT')
        ) {
          flagStatement(i, i + len, kw.word);
        }
        out.push(token);
        i += len;

        if (kw.word === 'REM' || kw.word === 'DATA') {
          while (i < body.length) {
            const next = emitLiteral(i);
            if (next === null) return null;
            i = next;
          }
          statementStart = false;
          continue;
        }
        if (kw.word === 'PROC' || kw.word === 'FN') {
          while (i < body.length && ALNUM.test(body[i]!)) {
            if (!emit(body[i]!, i)) return null;
            i++;
          }
          statementStart = false;
          continue;
        }
        if (kw.lino) lino = true;
        statementStart = kw.word === 'THEN' || kw.word === 'ELSE';
        continue;
      }
      // Not a keyword - consume the whole variable name verbatim.
      let j = i;
      while (j < body.length && ALNUM.test(body[j]!)) j++;
      if (j < body.length && (body[j] === '$' || body[j] === '%')) j++;
      // A bare name may only open a statement as an assignment target:
      // A=…, A(1)=…, or the dyadic indirections A?n=… / A!n=….
      if (statementStart && !asm.active) {
        let k = j;
        while (body[k] === ' ' || body[k] === '\t') k++;
        const next = body[k];
        if (next !== '=' && next !== '(' && next !== '?' && next !== '!') {
          flagStatement(i, j, body.slice(i, j));
        }
      }
      for (; i < j; i++) if (!emit(body[i]!, i)) return null;
      statementStart = false;
      continue;
    }

    // String literal: copied verbatim, nothing inside is tokenized (but
    // `{...}` escapes let control/graphics bytes be authored and round-trip).
    if (ch === '"') {
      if (statementStart && !asm.active) flagStatement(i, i + 1, '"');
      out.push(0x22);
      i++;
      while (i < body.length && body[i] !== '"') {
        const next = emitLiteral(i);
        if (next === null) return null;
        i = next;
      }
      if (i < body.length) {
        out.push(0x22);
        i++;
      }
      statementStart = false;
      continue;
    }

    // Hex constant: '&' then a run of hex digits, copied so an A–F run isn't
    // mistaken for a keyword.
    if (ch === '&') {
      if (statementStart && !asm.active) flagStatement(i, i + 1, '&');
      out.push(0x26);
      i++;
      while (i < body.length && HEX.test(body[i]!)) {
        out.push(body.charCodeAt(i));
        i++;
      }
      statementStart = false;
      continue;
    }

    // ':' opens a new statement.
    if (ch === ':') {
      out.push(0x3a);
      i++;
      statementStart = true;
      continue;
    }

    // Anything else (digits, operators, punctuation) is copied verbatim.
    // '[' opens the inline assembler (validation off until ']' closes it);
    // at a statement start only the indirection/system forms ?a=… !a=… $a=…
    // @%=…, and '=' (a DEF FN result line) are valid openers.
    if (ch === '[') asm.active = true;
    else if (ch === ']') asm.active = false;
    else if (statementStart && !asm.active && !'?!$@='.includes(ch)) {
      flagStatement(i, i + 1, ch);
    }
    if (!emit(ch, i)) return null;
    statementStart = false;
    i += ch.length;
  }

  return failed ? null : out;
}
