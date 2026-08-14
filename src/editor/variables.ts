/**
 * Document-scanning variable autocompletion.
 *
 * A dialect's keyword completion (see {@link ./completions}) is static; this
 * module adds the *other* half - the variable names the user has actually
 * written in their program - as a second CodeMirror completion source. It is a
 * pure, dialect-agnostic scanner (like {@link ./programOutline} and
 * {@link ./lineNumbering}): it reads the document text, mirrors the highlighter's
 * keyword-vs-variable rule so keywords like PRINT/GOTO are never mistaken for
 * variables, and understands BBC-style procedure scope.
 *
 * Scope: BBC is the only dialect with multi-line named procedures
 * (`DEF PROC…ENDPROC`) that carry parameters and `LOCAL` variables; other
 * dialects have at most a single-line `DEF FN name(param)=expr`. Inside a
 * procedure the completion offers globals plus that procedure's params/locals;
 * elsewhere only globals, so one procedure's private names never leak into
 * another's scope.
 */
import type {
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from '@codemirror/autocomplete';
import { isInsideString } from './completions';
import { isBinaryDirective } from '../dialects/binaryDirective';
import { scannable } from './programOutline';
import type { OutlineCapabilities } from './programOutline';
import type { CrunchMatcher } from './crunch';

/** The dialect lexical facts the scanner needs (built in `buildBasicLanguage`). */
export interface VarNameRules {
  /** Leading identifier run, anchored `^` (letters + name extras + `$`). */
  headRe: RegExp;
  /** Whole variable token, anchored `^` (with digits/name-extras/suffix). */
  varRe: RegExp;
  /** Uppercase alphabetic keyword spellings, to reject keywords. */
  keywords: Set<string>;
  /** Longest keyword length, for the keyword-prefix scan. */
  maxWordLen: number;
  /** Hex-literal regex (e.g. BBC `&FF`), anchored `^`, or null. */
  hexRe: RegExp | null;
  /**
   * Keywords that glue to a trailing name to form a call, not a variable -
   * `PROC`/`FN` on BBC (`PROCfoo`, `FNbar`). Such a run is skipped whole: on
   * these machines a name can't start with the prefix (`PROCESS` is `PROC ESS`).
   */
  callPrefixes: string[];
  /**
   * Set for the crunched (MS-BASIC) dialects: identifier runs are split the
   * way the ROM tokenizer splits them (`POKEA` → POKE + variable A) instead
   * of using the whole-run keyword rule. See {@link ./crunch}.
   */
  crunch?: CrunchMatcher | null;
  /**
   * Set when READ takes a DATA item literally rather than evaluating it (BBC,
   * CPC, the Microsoft family), so the words inside a DATA statement are values
   * and never variable names. Left unset for Sinclair, where a DATA item is an
   * expression and its names are ordinary usages. See {@link ./variableLexis}.
   */
  dataIsVerbatim?: boolean;
}

/**
 * A lexical scope with its own local names: a BBC `DEF PROC…ENDPROC` body, or a
 * single-line `DEF FN name(params)=…` (start === end). `locals` holds the
 * header parameters plus any `LOCAL`-declared variables.
 */
export interface ProcRegion {
  name: string;
  /** 0-based physical row where the scope opens. */
  startRow: number;
  /** 0-based physical row where it closes (EOF row if never closed). */
  endRow: number;
  locals: Set<string>;
}

export interface VariableModel {
  /** Names visible everywhere (never a procedure's private param/local). */
  globals: Set<string>;
  /** Procedure/function scopes, in source order. */
  procs: ProcRegion[];
}

/** A number literal, matching the highlighter (`basicLanguage.ts`). */
const NUMBER_RE = /^\d+(\.\d*)?(E[+-]?\d+)?/i;

/** Drop a leading BASIC line number and its single separating space. */
function stripLineNo(raw: string): string {
  return raw.replace(/^\s*\d+\s?/, '');
}

/**
 * Add each comma-separated name in `list` (a parameter or LOCAL list) to `into`,
 * taking the variable token from each part.
 */
function addNames(
  list: string | undefined,
  rules: VarNameRules,
  into: Set<string>,
): void {
  if (!list) return;
  for (const part of list.split(',')) {
    const m = rules.varRe.exec(part.trim());
    if (m) into.add(m[0]);
  }
}

/** A variable occurrence found by {@link forEachVariable}. */
export interface VarToken {
  /** The variable name as written, including any type suffix. */
  text: string;
  /** 0-based index of the token within the scanned `code`. */
  index: number;
  /**
   * The keyword immediately preceding this token on the line (spaces aside), or
   * null - lets callers spot e.g. a FOR/NEXT control variable.
   */
  prevKeyword: string | null;
  /**
   * Crunched dialects only: the reserved word glued inside this name at a
   * position where a variable was expected (`SCORE` embeds `OR`) - the ROM
   * will split the name and fail, so lint should warn.
   */
  embedsKeyword?: string;
}

/**
 * Walk one line of (line-number-stripped, string/REM-blanked) code, calling
 * `visit` for each variable token. Mirrors the highlighter's tokenising order
 * (`basicLanguage.ts` token()): numbers and hex literals are consumed so their
 * letters (`1E5`, `&FF`) aren't read as names, and an identifier run that is a
 * keyword prefix (consuming the whole run, or ending in `$`) or a PROC/FN call
 * is skipped. On the machines that keep DATA items verbatim its items are
 * skipped to the next `:`; on Sinclair they are expressions and are scanned.
 * Dialects with `rules.crunch` set use the ROM-splitting scanner
 * ({@link forEachVariableCrunched}) instead.
 */
export function forEachVariable(
  code: string,
  rules: VarNameRules,
  visit: (token: VarToken) => void,
): void {
  if (rules.crunch) {
    forEachVariableCrunched(code, rules, rules.crunch, visit);
    return;
  }
  let i = 0;
  let prevKeyword: string | null = null;
  while (i < code.length) {
    const rest = code.slice(i);
    // Numbers first (so 1E5 doesn't leak "E5"), then hex literals (&FF).
    const num = NUMBER_RE.exec(rest);
    if (num) {
      i += num[0].length;
      prevKeyword = null;
      continue;
    }
    const hex = rules.hexRe?.exec(rest);
    if (hex) {
      i += hex[0].length;
      prevKeyword = null;
      continue;
    }
    const head = rules.headRe.exec(rest);
    if (!head) {
      // Keep prevKeyword across spaces (FOR<space>I) but drop it on operators.
      if (!/\s/.test(rest[0]!)) prevKeyword = null;
      i += 1;
      continue;
    }
    const run = head[0];
    const upper = run.toUpperCase();
    // A PROC/FN call (prefix + name) is not a variable - skip the whole run.
    if (
      rules.callPrefixes.some(
        (p) => upper.length > p.length && upper.startsWith(p),
      )
    ) {
      i += run.length;
      prevKeyword = null;
      continue;
    }
    // Longest keyword prefix that consumes the whole run (or ends in `$`).
    let keywordLen = 0;
    for (let len = Math.min(upper.length, rules.maxWordLen); len >= 2; len--) {
      const candidate = upper.slice(0, len);
      if (
        rules.keywords.has(candidate) &&
        (len === run.length || candidate.endsWith('$'))
      ) {
        keywordLen = len;
        break;
      }
    }
    if (keywordLen > 0) {
      prevKeyword = upper.slice(0, keywordLen);
      // Where READ takes items literally they are values, not names, so skip
      // to the next statement. On Sinclair a DATA item is an expression, so its
      // names are ordinary usages and the scan continues.
      if (prevKeyword === 'DATA' && rules.dataIsVerbatim) {
        const colon = code.indexOf(':', i + keywordLen);
        if (colon === -1) return;
        i = colon;
        continue;
      }
      i += keywordLen;
      continue;
    }
    const v = rules.varRe.exec(rest);
    const token = v ? v[0] : run;
    visit({ text: token, index: i, prevKeyword });
    prevKeyword = null;
    i += token.length;
  }
}

/** Keywords that open a fresh statement, so a variable may follow. */
const CRUNCH_STMT_OPENERS = ['THEN', 'ELSE'];
/** Keywords directly followed by a variable reference. */
const CRUNCH_VAR_EXPECTING = [
  'LET',
  'FOR',
  'NEXT',
  'DIM',
  'INPUT',
  'READ',
  'GET',
];

/**
 * The crunched-dialect scanner: split identifier runs the way the MS-BASIC ROM
 * tokenizer does (longest keyword at every position - `POKEA` is POKE + A,
 * `FORI=1TO10` is FOR I = 1 TO 10), so intentional crunch never reads as a
 * variable name.
 *
 * One heuristic keeps the valuable broken-name warning: while scanning, track
 * whether the ROM expects a *variable* next - at a statement start (line
 * start, after `:`, after THEN/ELSE) or after LET/FOR/NEXT/DIM/INPUT/READ/GET.
 * A run with a keyword glued mid-name in that position (`SCORE=1` at a
 * statement start) is a name the ROM will split and choke on, so it is emitted
 * whole with `embedsKeyword` set for lint. In expression position the same
 * run splits silently (`FORI=ATOB` is A TO B, legitimate crunch). A run whose
 * *first* segment is a keyword always splits silently (`TOTAL` is TO TAL).
 *
 * REM stops the scan (rest of line is a comment even when `scannable()`'s
 * word-boundary check missed it, e.g. `REMARK`); DATA skips to the next `:`
 * (the ROM keeps DATA items verbatim, so they are not variables).
 */
function forEachVariableCrunched(
  code: string,
  rules: VarNameRules,
  crunch: CrunchMatcher,
  visit: (token: VarToken) => void,
): void {
  let i = 0;
  let prevKeyword: string | null = null;
  let ctx: 'stmt' | 'var' | 'none' = 'stmt';
  while (i < code.length) {
    const rest = code.slice(i);
    // Numbers first (so 1E5 doesn't leak "E5"), then hex literals (&FF).
    const num = NUMBER_RE.exec(rest);
    if (num) {
      i += num[0].length;
      prevKeyword = null;
      ctx = 'none';
      continue;
    }
    const hex = rules.hexRe?.exec(rest);
    if (hex) {
      i += hex[0].length;
      prevKeyword = null;
      ctx = 'none';
      continue;
    }
    const head = rules.headRe.exec(rest);
    if (!head) {
      const ch = rest[0]!;
      if (ch === ':') {
        ctx = 'stmt';
        prevKeyword = null;
      } else if (/\s/.test(ch)) {
        // Spaces preserve both the context and prevKeyword (FOR<space>I).
      } else if (ch === ',' || ch === ';') {
        // List separators keep the context; they end any keyword adjacency.
        prevKeyword = null;
      } else {
        ctx = 'none';
        prevKeyword = null;
      }
      i += 1;
      continue;
    }
    const run = head[0];
    const upper = run.toUpperCase();
    // A PROC/FN call (prefix + name) is not a variable - skip the whole run.
    if (
      rules.callPrefixes.some(
        (p) => upper.length > p.length && upper.startsWith(p),
      )
    ) {
      i += run.length;
      prevKeyword = null;
      ctx = 'none';
      continue;
    }
    const kw = crunch.keywordAt(rest, 0);
    if (kw) {
      if (kw === 'REM') return; // rest of the line is a comment
      prevKeyword = kw;
      if (kw === 'DATA' && rules.dataIsVerbatim) {
        // DATA items are verbatim until the next statement.
        const colon = code.indexOf(':', i + kw.length);
        if (colon === -1) return;
        i = colon; // the ':' itself resets ctx on the next pass
        continue;
      }
      ctx = CRUNCH_STMT_OPENERS.includes(kw)
        ? 'stmt'
        : CRUNCH_VAR_EXPECTING.includes(kw)
          ? 'var'
          : 'none';
      i += kw.length;
      continue;
    }
    const v = rules.varRe.exec(rest);
    const token = v ? v[0] : run;
    // Glued keywords are matched against the raw rest-of-line, not just the
    // token, so a `$`-suffixed keyword at the token boundary still splits
    // (`ALEFT$(` is A + LEFT$).
    const j = crunch.firstInteriorKeyword(rest, token.length);
    if (j !== -1 && (ctx === 'stmt' || ctx === 'var')) {
      // A variable was expected here, so the run is one intended name the
      // ROM will split - keep it whole and flag it for lint.
      visit({
        text: token,
        index: i,
        prevKeyword,
        embedsKeyword: crunch.keywordAt(rest, j)!,
      });
      i += token.length;
    } else if (j !== -1) {
      // Expression position: plausible intentional crunch (A TO B) - emit
      // the fragment before the keyword and let the keyword match next pass.
      visit({ text: token.slice(0, j), index: i, prevKeyword });
      i += j;
    } else {
      visit({ text: token, index: i, prevKeyword });
      i += token.length;
    }
    prevKeyword = null;
    ctx = 'none';
  }
}

/** Names-only convenience over {@link forEachVariable}. */
function scanLine(
  code: string,
  rules: VarNameRules,
  emit: (name: string) => void,
): void {
  forEachVariable(code, rules, (t) => emit(t.text));
}

/** A variable occurrence with its editor-line position. */
export interface Occurrence {
  name: string;
  /** 1-based editor line. */
  line: number;
  /** 0-based column of the token within the line. */
  column: number;
  /** 0-based column just past the token. */
  endColumn: number;
  /** Keyword just before the token on the line (e.g. FOR), or null. */
  prevKeyword: string | null;
  /** Character immediately after the token (e.g. `(` for an array), or ''. */
  nextChar: string;
  /** Reserved word glued mid-name where a variable was expected, if any. */
  embedsKeyword?: string;
}

/**
 * Visit every variable occurrence in a whole program, with line/column info.
 *
 * The positioned sibling of {@link forEachVariable}: same recognition rules,
 * plus the line-number prefix arithmetic that turns a token's index within the
 * scanned code back into a column of the editor line. Shared by the variable
 * lint and by usage lookup so both read a program the same way.
 */
export function eachOccurrence(
  source: string,
  rules: VarNameRules,
  visit: (occ: Occurrence) => void,
): void {
  source.split('\n').forEach((raw, row) => {
    if (isBinaryDirective(raw)) return; // opaque #BIN payload, not code
    const m = /^\s*\d+\s?/.exec(raw);
    const prefixLen = m ? m[0].length : 0;
    const code = scannable(raw.slice(prefixLen));
    forEachVariable(code, rules, (t) => {
      const column = prefixLen + t.index;
      visit({
        name: t.text,
        line: row + 1,
        column,
        endColumn: column + t.text.length,
        prevKeyword: t.prevKeyword,
        nextChar: code[t.index + t.text.length] ?? '',
        embedsKeyword: t.embedsKeyword,
      });
    });
  });
}

/** The smallest scope region containing `row`, or null when at top level. */
export function enclosingRegion(
  regions: ProcRegion[],
  row: number,
): ProcRegion | null {
  let best: ProcRegion | null = null;
  for (const r of regions) {
    if (row < r.startRow || row > r.endRow) continue;
    if (!best || r.endRow - r.startRow < best.endRow - best.startRow) best = r;
  }
  return best;
}

/** Detect `DEF PROC…ENDPROC` bodies and their params/LOCALs (BBC). */
function findProcRegions(
  codeRows: string[],
  rules: VarNameRules,
): ProcRegion[] {
  const regions: ProcRegion[] = [];
  let open: ProcRegion | null = null;
  codeRows.forEach((code, row) => {
    if (!open) {
      const dp = /\bDEF\s*PROC([A-Za-z0-9_]+)\s*(?:\(([^)]*)\))?/i.exec(code);
      if (dp) {
        open = {
          name: `PROC${dp[1]}`,
          startRow: row,
          endRow: row,
          locals: new Set(),
        };
        addNames(dp[2], rules, open.locals);
        regions.push(open);
      }
    }
    if (open) {
      open.endRow = row;
      for (const m of code.matchAll(/\bLOCAL\b\s+([^:]*)/gi))
        addNames(m[1], rules, open.locals);
      if (/\bENDPROC\b/i.test(code)) open = null;
    }
  });
  return regions;
}

/** Detect single-line `DEF FN name(params)=…` scopes (Spectrum/C64/TRS-80/BBC). */
function findFnRegions(codeRows: string[], rules: VarNameRules): ProcRegion[] {
  const regions: ProcRegion[] = [];
  codeRows.forEach((code, row) => {
    for (const m of code.matchAll(
      /\bDEF\s*FN([A-Za-z0-9_]*)\s*\(([^)]*)\)/gi,
    )) {
      const locals = new Set<string>();
      addNames(m[2], rules, locals);
      if (locals.size)
        regions.push({
          name: `FN${m[1]}`,
          startRow: row,
          endRow: row,
          locals,
        });
    }
  });
  return regions;
}

/**
 * Build the variable model for a program: every variable name, partitioned into
 * globals and per-procedure params/locals. `caps` (from
 * {@link outlineCapabilities}) gates procedure/function parsing so non-BBC
 * dialects don't pay for scope they don't have.
 */
export function collectVariables(
  docText: string,
  rules: VarNameRules,
  caps: OutlineCapabilities,
): VariableModel {
  const codeRows = docText
    .split('\n')
    .map((raw) => scannable(stripLineNo(raw)));

  const procs = caps.hasProc ? findProcRegions(codeRows, rules) : [];
  const fns = caps.hasFn ? findFnRegions(codeRows, rules) : [];
  const regions = [...procs, ...fns];

  const globals = new Set<string>();
  codeRows.forEach((code, row) => {
    const region = enclosingRegion(regions, row);
    scanLine(code, rules, (name) => {
      // A name that is this region's own param/local stays private; everything
      // else (including implicit globals used inside a procedure) is global.
      if (region?.locals.has(name)) return;
      globals.add(name);
    });
  });

  return { globals, procs: regions };
}

/**
 * The variable names to offer at physical row `row`: globals plus the enclosing
 * procedure's params/locals (if any), sorted for a stable menu.
 */
export function variablesInScopeAt(
  model: VariableModel,
  row: number,
): string[] {
  const names = new Set(model.globals);
  const region = enclosingRegion(model.procs, row);
  if (region) for (const n of region.locals) names.add(n);
  return [...names].sort();
}

/**
 * Build the CodeMirror completion source that offers in-scope variable names.
 * Registered alongside the keyword source via a second
 * `language.data.of({ autocomplete })` in `buildBasicLanguage`.
 */
export function makeVariableSource(
  rules: VarNameRules,
  caps: OutlineCapabilities,
): CompletionSource {
  const body = rules.varRe.source.replace(/^\^/, '');
  const matchRe = new RegExp(body);
  const validFor = new RegExp(`^${body}$`);

  return (context: CompletionContext) => {
    const word = context.matchBefore(matchRe);
    if (!word && !context.explicit) return null;
    if (isInsideString(context)) return null;

    // Blank out the token being typed before scanning: a name whose only
    // occurrence is the word under the cursor would otherwise complete to
    // itself - and, as an exact match, outrank the keyword suggestions (which
    // breaks the "." abbreviation, e.g. "PR." must accept PRINT, not "PR").
    let docText = context.state.doc.toString();
    if (word)
      docText =
        docText.slice(0, word.from) +
        ' '.repeat(word.to - word.from) +
        docText.slice(word.to);

    const model = collectVariables(docText, rules, caps);
    const row = context.state.doc.lineAt(context.pos).number - 1;
    const names = variablesInScopeAt(model, row);
    if (names.length === 0) return null;

    let from = word ? word.from : context.pos;
    let valid: CompletionResult['validFor'] = validFor;
    const crunch = rules.crunch;
    if (crunch && word) {
      // Crunched dialects: when no known variable matches the whole run, the
      // run's head is glued keyword(s) (`POKEA`) - re-anchor to the tail so
      // `A…` names complete. When the typed tail itself grows a glued keyword
      // (`A` → `ATHEN`), validFor fails and CodeMirror re-queries, which
      // re-anchors past the new keyword.
      const upper = word.text.toUpperCase();
      if (!names.some((n) => n.toUpperCase().startsWith(upper))) {
        from = word.from + crunch.tailStart(word.text);
      }
      valid = (text) => validFor.test(text) && crunch.tailStart(text) === 0;
    }

    return {
      from,
      validFor: valid,
      options: names.map((name) => ({ label: name, type: 'variable' })),
    };
  };
}
