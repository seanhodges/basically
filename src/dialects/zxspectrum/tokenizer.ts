import { CharsetError, type KeywordInfo, type TokenizeError } from '../types';
import {
  spectrumCharset,
  parseChar,
  ENTER,
  NUMBER_MARKER,
  QUOTE,
  UDG_LAST,
} from './charset';
import { spectrumKeywords, keywordAliases } from './keywords';
import { encodeSpectrumNumber } from './numbers';
import { parseFloatOverride } from './floatOverride';

export interface TokenizedProgram {
  /** Tokenized program area (concatenated lines), as stored from PROG. */
  bytes: Uint8Array;
  errors: TokenizeError[];
}

const IDENT = /[A-Za-z0-9$]/;
const WS = /[ \t]/;

/** Per-keyword-table derived tables, cached so each table is built once. */
interface KeywordTables {
  /** Canonical-word matches, plus glued aliases, longest first. */
  matchers: { word: string; canonical: string }[];
  canonicalToken: Map<string, number>;
  statementKeywords: Set<string>;
}

const tablesCache = new WeakMap<KeywordInfo[], KeywordTables>();

/**
 * Derive (and memoize) the matcher/token/statement tables for a keyword set.
 * Defaults to the 48K {@link spectrumKeywords}; the 128K passes its own table
 * (the 48K set plus SPECTRUM/PLAY) so the shared logic stays single-sourced.
 */
function tablesFor(keywords: KeywordInfo[]): KeywordTables {
  const cached = tablesCache.get(keywords);
  if (cached) return cached;
  const matchers = [
    ...keywords.map((k) => ({ word: k.word, canonical: k.word })),
    ...Object.entries(keywordAliases).map(([alias, canonical]) => ({
      word: alias,
      canonical,
    })),
  ].sort((a, b) => b.word.length - a.word.length);
  const canonicalToken = new Map(keywords.map((k) => [k.word, k.token]));
  const statementKeywords = new Set(
    keywords.filter((k) => k.kind === 'command').map((k) => k.word),
  );
  const tables: KeywordTables = { matchers, canonicalToken, statementKeywords };
  tablesCache.set(keywords, tables);
  return tables;
}

/**
 * Tokenize plain-text ZX Spectrum BASIC into the program-area byte layout:
 * per line - u16 BE line number, u16 LE length (of body + ENTER), tokenized
 * body, 0x0D. The `keywords` table defaults to the 48K set; the 128K dialect
 * passes its extended table (adding SPECTRUM/PLAY).
 */
export function tokenizeProgram(
  source: string,
  keywords: KeywordInfo[] = spectrumKeywords,
  /**
   * Highest UDG code the dialect exposes. The 48K runs `\a`-`\u` (0x90-0xA4);
   * the 128K reuses 0xA3/0xA4 as the SPECTRUM/PLAY tokens, so it passes 0xA2 and
   * `\t`/`\u` earn a non-fatal warning.
   */
  udgLast: number = UDG_LAST,
): TokenizedProgram {
  const tables = tablesFor(keywords);
  const out: number[] = [];
  const errors: TokenizeError[] = [];
  // -1 rather than 0 so a leading line 0 (a `0 REM` protection line) is accepted
  // as strictly ascending.
  let prevLineNo = -1;

  const lines = source.split('\n');
  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li]!;
    const text = raw.trim();
    if (text === '') continue;
    const editorLine = li + 1;
    // Columns are offsets into the *physical* editor line (the linter adds them
    // to the line start), but everything below is measured against the trimmed
    // text - so every column owes the indent width. Trailing space costs
    // nothing, only the leading run matters.
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
    // >16383 cannot be a real Spectrum line: a framing error that blocks the
    // image. Line 0 and 10000-16383 are outside the editor's normal 1-9999
    // range but the ROM can hold them (a `0 REM` protection line, say), so keep
    // them a non-fatal squiggle and still build - imports stay runnable.
    if (lineNo > 16383) {
      errors.push({
        line: editorLine,
        column: lead,
        message: `Line number ${lineNo} out of range 0-16383`,
      });
      continue;
    }
    if (lineNo < 1 || lineNo > 9999) {
      errors.push({
        line: editorLine,
        column: lead,
        fatal: false,
        message: `Line number ${lineNo} is outside the normal 1-9999 range`,
      });
    }
    if (lineNo <= prevLineNo) {
      errors.push({
        line: editorLine,
        column: lead,
        message: `Line number ${lineNo} not greater than previous line ${prevLineNo}`,
      });
      continue;
    }

    const body = text.slice(m[0].length);
    const tokens = tokenizeBody(
      body,
      editorLine,
      lead + m[0].length,
      errors,
      tables,
      udgLast,
    );
    if (tokens === null) continue; // error already recorded

    prevLineNo = lineNo;
    out.push((lineNo >> 8) & 0xff, lineNo & 0xff);
    const len = tokens.length + 1; // body + ENTER terminator
    out.push(len & 0xff, (len >> 8) & 0xff);
    out.push(...tokens, ENTER);
  }

  return { bytes: Uint8Array.from(out), errors };
}

/**
 * A genuine `{...}` control directive or `\a`-`\u` UDG escape at index i, or
 * null for a literal `{`/`\` character. Used in the expression path so embedded
 * escapes emit their bytes while a literal brace still trips the statement
 * checks. Never throws: `parseChar` returns a literal for a non-directive `{`,
 * and only `\`+`[a-u]` (a real UDG) is forwarded to it.
 */
function escapeUnitAt(
  body: string,
  i: number,
): { codes: number[]; length: number } | null {
  const ch = body[i];
  if (ch === '{') {
    const parsed = parseChar(body, i);
    return parsed.length > 1 ? parsed : null; // length 1 = a literal '{'
  }
  if (ch === '\\' && /[a-uA-U]/.test(body[i + 1] ?? '')) {
    return parseChar(body, i);
  }
  return null;
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

function tokenizeBody(
  body: string,
  editorLine: number,
  colOffset: number,
  errors: TokenizeError[],
  tables: KeywordTables,
  udgLast: number,
): number[] | null {
  const { matchers, canonicalToken, statementKeywords } = tables;
  const out: number[] = [];
  const upper = body.toUpperCase();
  let i = 0;
  let firstWordChecked = false;
  // Whether the cursor sits at a statement opener. Distinct from
  // `firstWordChecked`, which says only "this line has produced its first
  // command keyword" and stays latched: it drives the *fatal* first-word check
  // and the line-framing rules below, so it must not be re-armed. This flag is
  // re-armed at every ':' and after THEN, and drives the non-fatal
  // per-statement lint - which is gated on `firstWordChecked` throughout, so
  // the first statement on a line keeps being reported the old way, once.
  let statementStart = true;
  let prevSignificant = '';
  // Track what a line emits before any statement keyword, for the trailing
  // "no statement keyword" check. A line whose only content is leading
  // control-code / graphics escapes (a bare `{BRIGHT 0}`, as real tapes save
  // and the detokenizer reproduces) is a valid, non-fatal line that just
  // carries embedded bytes; a leading string or bare numeric literal with no
  // statement keyword is still "nonsense in BASIC".
  let leadingControlEscape = false;
  let leadingOtherContent = false;
  // DEF FN parameter reservation. On real hardware the ROM's DEF FN command
  // reserves a hidden 6-byte slot - the number marker 0x0E plus five zero bytes
  // - after each parameter, so a later FN call has somewhere to store the
  // argument value (missing slots trip a "Q Parameter error"). We insert them
  // transparently: `awaitingDefFnParen` spans the DEF FN token to its `(`,
  // `inDefFnParams` spans the `(` to its `)`, and `paramPending` marks that a
  // parameter name has been emitted and still needs its slot.
  let awaitingDefFnParen = false;
  let inDefFnParams = false;
  let paramPending = false;

  const fail = (message: string, at: number): null => {
    errors.push({ line: editorLine, column: colOffset + at, message });
    return null;
  };

  // A statement after the first that doesn't open the way the ROM requires.
  // Non-fatal: unlike the first-word check (which also decides whether the line
  // can be framed at all), the bytes here are unambiguous - the machine would
  // store them and object only at RUN - so this keeps its squiggle without
  // blocking the image or hardware export. Spectrum BASIC has no implied LET,
  // so a bare name is as wrong as anything else; there is no assignment-shape
  // escape hatch to check for.
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
      message: `Statement must start with a command keyword (got ${got})${hint}`,
      fatal: false,
    });
  };

  // A `\t`/`\u` UDG escape on a dialect that reuses 0xA3/0xA4 as tokens (the
  // 128K): keep the byte but flag it non-fatally, since there is no such UDG.
  const warnRestrictedUdg = (at: number): void => {
    if (udgLast >= UDG_LAST || body[at] !== '\\') return;
    const next = body[at + 1];
    if (!next || !/[a-uA-U]/.test(next)) return;
    const code = 0x90 + (next.toLowerCase().charCodeAt(0) - 97);
    if (code <= udgLast) return;
    errors.push({
      line: editorLine,
      column: colOffset + at,
      fatal: false,
      message:
        `\\${next} is not a UDG on the 128K (its UDGs are \\a-\\s); byte ` +
        `0x${code.toString(16).toUpperCase()} is the ${
          code === 0xa3 ? 'SPECTRUM' : 'PLAY'
        } token`,
    });
  };

  const emitChar = (ch: string, at: number): boolean => {
    try {
      out.push(...spectrumCharset.toMachine(ch));
      return true;
    } catch (e) {
      if (e instanceof CharsetError) {
        fail(e.message, at);
        return false;
      }
      throw e;
    }
  };

  // Escape-aware emission for string literals: `\a`-`\u` UDGs and `{...}`
  // control directives. Returns source chars consumed, or -1 on error.
  const emitParsed = (at: number): number => {
    try {
      const { codes, length } = parseChar(body, at);
      warnRestrictedUdg(at);
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

    // Spaces policy: inter-token spacing is normalized, not stored.
    // A real Spectrum keeps the exact spaces you type, but the detokenizer
    // re-inserts a canonical space wherever two tokens would otherwise glue
    // (e.g. GOTO + 10). Storing typed spaces too would double those on the next
    // detokenize→tokenize pass, and a boundary the detokenizer *must* separate
    // has no stored space to reproduce - so the two directions can only stay
    // byte-exact if both normalize. Byte-exactness of redundant/absent spaces is
    // therefore out of scope; everything else round-trips exactly.
    if (ch === ' ' || ch === '\t') {
      prevSignificant = ' ';
      i++;
      continue;
    }

    // ':' separates statements, and a run of them (or a leading or trailing
    // one) is just an empty statement - real tape programs contain those, so
    // re-arming without complaint is the whole handling. Byte-identical to the
    // generic character path this used to fall through to once the first word
    // had been checked: the charset maps ':' to 0x3a and records it as the
    // previous significant character, exactly as here.
    if (ch === ':') {
      out.push(0x3a);
      statementStart = true;
      prevSignificant = ':';
      i++;
      continue;
    }

    // Strings: "" inside a string stores a doubled quote.
    if (ch === '"') {
      if (!firstWordChecked) leadingOtherContent = true;
      else if (statementStart) flagStatement(i, i + 1, '"');
      statementStart = false;
      out.push(QUOTE);
      i++;
      let closed = false;
      while (i < body.length) {
        if (body[i] === '"') {
          if (body[i + 1] === '"') {
            out.push(QUOTE, QUOTE);
            i += 2;
            continue;
          }
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

    // Keywords (longest match, with word-boundary checks for word keywords).
    let matched = false;
    for (const kw of matchers) {
      const consumed = matchKeywordAt(upper, i, kw.word);
      if (consumed < 0) continue;
      const firstCh = kw.word[0]!;
      const lastCh = kw.word[kw.word.length - 1]!;
      if (/[A-Z]/.test(firstCh) && IDENT.test(prevSignificant)) continue;
      if (/[A-Z]/.test(lastCh)) {
        const next = upper[i + consumed];
        if (next !== undefined && IDENT.test(next)) continue;
      }

      if (!firstWordChecked) {
        if (!statementKeywords.has(kw.canonical)) {
          return fail(
            `Statement must start with a command keyword (got ${kw.word})`,
            i,
          );
        }
        firstWordChecked = true;
      } else if (statementStart && !statementKeywords.has(kw.canonical)) {
        flagStatement(i, i + consumed, kw.word);
      }

      const token = canonicalToken.get(kw.canonical)!;
      out.push(token);
      i += consumed;
      prevSignificant = ' ';
      matched = true;
      // THEN introduces a fresh statement (`IF a=1 THEN PRINT b`). It must be
      // re-armed *after* the check above, or THEN - an operator, not a command
      // - would flag itself. Every other keyword closes the opener. Matched on
      // the canonical form so aliases like GOTO/GO TO resolve alike.
      statementStart = kw.canonical === 'THEN';

      if (kw.canonical === 'REM') {
        // Rest of the line is literal text.
        if (!emitRest(out, body, i, fail, warnRestrictedUdg)) return null;
        i = body.length;
      } else if (kw.canonical === 'BIN') {
        i = emitBin(out, body, upper, i);
        prevSignificant = '0';
      } else if (kw.canonical === 'DEF FN') {
        awaitingDefFnParen = true;
      }
      break;
    }
    if (matched) continue;

    // DEF FN parameter list: reserve the ROM's hidden 6-byte value slot after
    // each parameter (see the flags above). The opening `(` starts the list;
    // each `,` or the closing `)` flushes the pending parameter's slot first.
    if (awaitingDefFnParen && ch === '(') {
      out.push(0x28);
      awaitingDefFnParen = false;
      inDefFnParams = true;
      paramPending = false;
      statementStart = false;
      prevSignificant = '(';
      i++;
      continue;
    }
    if (inDefFnParams && (ch === ',' || ch === ')')) {
      if (paramPending) {
        out.push(NUMBER_MARKER, 0, 0, 0, 0, 0);
        paramPending = false;
      }
      out.push(ch.charCodeAt(0));
      if (ch === ')') inDefFnParams = false;
      statementStart = false;
      prevSignificant = ch;
      i++;
      continue;
    }

    // Embedded escapes outside strings, accepted so a detokenized listing with
    // control/graphics bytes re-tokenizes byte-exactly: a `{=…}` numeric
    // override (a bare marker whose digits were absent), a `{INK n}` / `{0xNN}`
    // control directive, or a `\a`-`\u` UDG. None of these is the statement's
    // leading keyword, so they run before the command-keyword guard; a literal
    // `{`/`\` (not a directive/escape) falls through to it as before.
    if (ch === '{') {
      const override = parseFloatOverride(body, i);
      if (override) {
        if (!firstWordChecked) leadingOtherContent = true;
        else if (statementStart)
          flagStatement(i, override.end, body.slice(i, override.end));
        statementStart = false;
        out.push(NUMBER_MARKER, ...override.bytes);
        i = override.end;
        prevSignificant = '0';
        // A `{=…}` override inside a DEF FN parameter list *is* that
        // parameter's reserved slot, so don't also auto-insert one. Keeps the
        // manual `DEF FN a(i{=0})` hack byte-identical and preserves a non-zero
        // reserved value imported from a real tape.
        if (inDefFnParams) paramPending = false;
        continue;
      }
    }
    // Deliberately leaves `statementStart` armed: a control escape carries
    // bytes rather than opening a statement, so `PRINT 1:{INK 2}PRNT 2` still
    // checks PRNT and `{INK 2}:{PAPER 6}` stays clean - the same reading the
    // line-level `leadingControlEscape` rule already takes.
    const escape = escapeUnitAt(body, i);
    if (escape) {
      if (!firstWordChecked) leadingControlEscape = true;
      warnRestrictedUdg(i);
      out.push(...escape.codes);
      i += escape.length;
      prevSignificant = ' ';
      continue;
    }

    if (!firstWordChecked) {
      return fail(
        'Statement must start with a command keyword (e.g. LET, PRINT, IF…)',
        i,
      );
    }

    // Anything else opening a later statement: a bare name, a number, or a
    // stray symbol. Sits below the guard above so the first statement on a line
    // is never reported twice. A number is wrong here like any other: Spectrum
    // BASIC has no `IF … THEN <line>` shorthand - the jump is `THEN GO TO n` -
    // so THEN never legitimately introduces a bare line number.
    if (statementStart) {
      if (/[A-Za-z]/.test(ch)) {
        let j = i;
        while (j < body.length && IDENT.test(body[j]!)) j++;
        // An assignment without LET is the likeliest real hit, and the rule is
        // unobvious coming from a BASIC that implies it, so say so outright.
        let k = j;
        while (body[k] === ' ') k++;
        flagStatement(
          i,
          j,
          body.slice(i, j),
          body[k] === '=' ? ' - ZX Spectrum BASIC needs LET to assign' : '',
        );
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

    // Numeric literal not continuing an identifier.
    if (/[0-9.]/.test(ch) && !IDENT.test(prevSignificant)) {
      const numMatch = /^(\d+(\.\d*)?|\.\d+)(E[+-]?\d+)?/.exec(upper.slice(i));
      if (numMatch && numMatch[0] !== '.') {
        const numText = numMatch[0];
        const value = parseFloat(numText);
        for (const c of numText) out.push(c.charCodeAt(0));
        out.push(NUMBER_MARKER);
        const afterDigits = i + numText.length;
        // An explicit `{=…}` override stores the ROM's authoritative form (it
        // differs from the digits for protection tricks); otherwise encode the
        // digits as the ROM would.
        const override = parseFloatOverride(body, afterDigits);
        if (override) {
          out.push(...override.bytes);
          i = override.end;
        } else {
          try {
            out.push(...encodeSpectrumNumber(value));
          } catch {
            return fail(`Number out of range: ${numText}`, i);
          }
          i = afterDigits;
        }
        prevSignificant = '0';
        continue;
      }
    }

    if (!emitChar(body[i]!, i)) return null;
    // A parameter name char (a letter or `$`) inside a DEF FN list: mark that a
    // reserved slot is now owed, to be flushed at the next `,` or `)`.
    if (inDefFnParams && IDENT.test(body[i]!)) paramPending = true;
    prevSignificant = body[i]!;
    i++;
  }

  if (!firstWordChecked && out.length > 0) {
    // A line whose only content is leading control-code / graphics escapes
    // (`{BRIGHT 0}` and friends) is valid and non-fatal: real tapes save such
    // lines and the detokenizer round-trips them, so accept the emitted bytes.
    // A leading string or bare numeric literal with no statement keyword is
    // still nonsense.
    if (leadingControlEscape && !leadingOtherContent) return out;
    return fail('Line has a number but no statement', 0);
  }
  return out;
}

/** Emit the rest of the line verbatim (REM body), honouring escapes. */
function emitRest(
  out: number[],
  body: string,
  start: number,
  fail: (m: string, at: number) => null,
  warnRestrictedUdg: (at: number) => void,
): boolean {
  let j = start;
  if (body[j] === ' ') j++;
  while (j < body.length) {
    try {
      const { codes, length } = parseChar(body, j);
      warnRestrictedUdg(j);
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

/** Emit the binary digits after BIN plus the inline value form. */
function emitBin(
  out: number[],
  body: string,
  upper: string,
  start: number,
): number {
  let j = start;
  while (WS.test(body[j] ?? '')) {
    out.push(body[j]!.charCodeAt(0));
    j++;
  }
  const digits = /^[01]+/.exec(upper.slice(j));
  if (!digits) return j;
  for (const c of digits[0]) out.push(c.charCodeAt(0));
  out.push(NUMBER_MARKER, ...encodeSpectrumNumber(parseInt(digits[0], 2)));
  return j + digits[0].length;
}
