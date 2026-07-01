/**
 * Document-scanning variable autocompletion.
 *
 * A dialect's keyword completion (see {@link ./completions}) is static; this
 * module adds the *other* half — the variable names the user has actually
 * written in their program — as a second CodeMirror completion source. It is a
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
  CompletionSource,
} from '@codemirror/autocomplete';
import { isInsideString } from './completions';
import { scannable } from './programOutline';
import type { OutlineCapabilities } from './programOutline';

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
   * Keywords that glue to a trailing name to form a call, not a variable —
   * `PROC`/`FN` on BBC (`PROCfoo`, `FNbar`). Such a run is skipped whole: on
   * these machines a name can't start with the prefix (`PROCESS` is `PROC ESS`).
   */
  callPrefixes: string[];
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
   * null — lets callers spot e.g. a FOR/NEXT control variable.
   */
  prevKeyword: string | null;
}

/**
 * Walk one line of (line-number-stripped, string/REM-blanked) code, calling
 * `visit` for each variable token. Mirrors the highlighter's tokenising order
 * (`basicLanguage.ts` token()): numbers and hex literals are consumed so their
 * letters (`1E5`, `&FF`) aren't read as names, and an identifier run that is a
 * keyword prefix (consuming the whole run, or ending in `$`) or a PROC/FN call
 * is skipped.
 */
export function forEachVariable(
  code: string,
  rules: VarNameRules,
  visit: (token: VarToken) => void,
): void {
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
    // A PROC/FN call (prefix + name) is not a variable — skip the whole run.
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

/** Names-only convenience over {@link forEachVariable}. */
function scanLine(
  code: string,
  rules: VarNameRules,
  emit: (name: string) => void,
): void {
  forEachVariable(code, rules, (t) => emit(t.text));
}

/** The smallest scope region containing `row`, or null when at top level. */
function enclosingRegion(
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

    const model = collectVariables(context.state.doc.toString(), rules, caps);
    const row = context.state.doc.lineAt(context.pos).number - 1;
    const names = variablesInScopeAt(model, row);
    if (names.length === 0) return null;

    return {
      from: word ? word.from : context.pos,
      validFor,
      options: names.map((name) => ({ label: name, type: 'variable' })),
    };
  };
}
