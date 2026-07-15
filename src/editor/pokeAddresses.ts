/**
 * Extracts the memory addresses a BASIC program POKEs into, for the memory-map
 * viewer's per-address markers and region highlight.
 *
 * A pure, dialect-agnostic editor helper in the mould of {@link ./programOutline}:
 * it walks the source line by line, blanks string literals and REM comments with
 * {@link scannable} (so `PRINT "POKE 5"` / `REM POKE 5` never match), and reads
 * the address argument after each POKE.
 *
 * Beyond bare literals ({@link pokeAddresses}), {@link pokeSites} also resolves
 * POKEs whose address is a variable or arithmetic expression (`POKE X,1`,
 * `POKE base+1,2`) by tracking simple `LET`/`FOR` assignments in a single pass
 * over the program in line-number order and evaluating the address expression
 * against them. This is best-effort static analysis: loops, `GOTO`, `INPUT`,
 * function calls (`PEEK`, `INT`, …) and hex literals can't be resolved, so those
 * POKEs are simply left out. A POKE inside a loop resolves to its first-iteration
 * address (the `FOR` start value).
 */
import { parseLines } from './lineNumbering';
import { scannable } from './programOutline';

/** A single POKE the program makes, with its resolved target address. */
export interface PokeSite {
  /** Resolved, rounded target address. */
  address: number;
  /** The raw first-argument text, e.g. `"X"` or `"base+1"` (for tooltips). */
  expr: string;
  /** True unless the address was written as a bare decimal literal. */
  computed: boolean;
  /** The BASIC line number the POKE is on. */
  lineNo: number;
}

/** Machine-specific facts that unlock extra address resolution. */
export interface PokeContext {
  /**
   * Base address of the machine's user-defined-graphics area, when it has one
   * reachable via `USR "letter"`. With it set, `POKE USR "a", n` (and any
   * expression containing `USR "a".."u"`) resolves to that graphic's address -
   * each UDG is 8 bytes from this base, so `USR "a"` = `udgBase`,
   * `USR "b"` = `udgBase + 8`, and so on. Omit for machines without UDGs; other
   * `USR` forms (`USR <number>`, whose value is only known once the called code
   * returns) stay unresolved regardless.
   */
  udgBase?: number;
}

/** Number of user-defined graphics reachable as `USR "a".."u"` (the 48K set). */
const UDG_COUNT = 21;
/** Bytes per user-defined graphic (an 8x8 bitmap). */
const UDG_STRIDE = 8;
// `USR "x"` used as an address: a UDG letter in double quotes, optionally glued
// to USR the way crunched entry allows (`USR"a"`). Applied only in code context.
const USR_UDG_RE = /^USR\s*"([A-Za-z])"/i;

/**
 * Rewrite `USR "a".."u"` calls to the decimal address of the graphic they
 * return, so the ordinary numeric resolver can place the POKE marker. Only
 * touches occurrences in real code - string literals and REM comments are
 * copied through verbatim, mirroring {@link scannable}'s state machine - and
 * only where a machine actually has UDGs (`udgBase` given). Other `USR` forms
 * are left untouched, so their POKEs stay unresolved as before.
 */
function resolveUdgCalls(body: string, udgBase: number): string {
  let out = '';
  let i = 0;
  let inString = false;
  while (i < body.length) {
    const ch = body[i]!;
    if (inString) {
      out += ch;
      if (ch === '"') inString = false;
      i++;
      continue;
    }
    if (ch === '"') {
      out += ch;
      inString = true;
      i++;
      continue;
    }
    // REM at a statement boundary: the rest is a comment; copy it untouched.
    if (/[Rr]/.test(ch) && /^rem\b/i.test(body.slice(i))) {
      out += body.slice(i);
      break;
    }
    // Only match USR at an identifier boundary, so a variable like `AUSR` or a
    // longer word never has its tail rewritten.
    const boundary = out === '' || !/[A-Za-z0-9$%]/.test(out[out.length - 1]!);
    const m = boundary ? USR_UDG_RE.exec(body.slice(i)) : null;
    if (m) {
      const index = m[1]!.toUpperCase().charCodeAt(0) - 65; // 'A' -> 0
      if (index >= 0 && index < UDG_COUNT) {
        out += String(udgBase + index * UDG_STRIDE);
        i += m[0].length;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

// POKE optionally glued to its argument the way single-keystroke / crunched
// entry allows (`POKE16384`, `POKEA`); the leading \b still stops it matching
// inside a longer word.
const POKE_RE = /\bPOKE\s*/i;
// A bare decimal integer - the only form counted as a non-computed literal.
const LITERAL_RE = /^\d+$/;
// [LET] VAR = ... anchored at the statement start (so `IF X=5` is not an
// assignment). The name keeps any `$`/`%` suffix so `A$` and `A` stay distinct.
const ASSIGN_RE = /^\s*(?:LET\s+)?([A-Za-z][A-Za-z0-9]*[$%]?)\s*=\s*(.*)$/i;
// FOR VAR = <start> TO ... - the start value is what a POKE in the body first sees.
const FOR_RE = /^\s*FOR\s+([A-Za-z][A-Za-z0-9]*[$%]?)\s*=\s*(.*?)\s+TO\b/i;

/**
 * Every POKE the program makes with an address we can resolve, in source order.
 * Addresses are not range-checked here (this helper can't see the machine's
 * address space) - callers filter against it.
 */
export function pokeSites(source: string, ctx: PokeContext = {}): PokeSite[] {
  const sites: PokeSite[] = [];
  const vars = new Map<string, number>();

  // Program order, not physical order: the value tracker models execution.
  const lines = parseLines(source).sort((a, b) => a.lineNo - b.lineNo);

  for (const line of lines) {
    // Turn `USR "a"` UDG calls into their address up front (where the machine
    // has UDGs) so everything downstream just sees a number.
    const body =
      ctx.udgBase !== undefined
        ? resolveUdgCalls(line.body, ctx.udgBase)
        : line.body;
    // Strings/REM are already blanked, so `:` and `,` are real separators.
    for (const stmt of scannable(body).split(':')) {
      const forMatch = FOR_RE.exec(stmt);
      if (forMatch) {
        assign(vars, forMatch[1]!, forMatch[2]!);
        continue;
      }

      const pokeMatch = POKE_RE.exec(stmt);
      if (pokeMatch) {
        const rest = stmt.slice(pokeMatch.index + pokeMatch[0].length);
        const comma = rest.indexOf(',');
        const expr = (comma === -1 ? rest : rest.slice(0, comma)).trim();
        const value = evalExpr(expr, vars);
        if (value !== undefined) {
          sites.push({
            address: Math.round(value),
            expr,
            computed: !LITERAL_RE.test(expr),
            lineNo: line.lineNo,
          });
        }
        continue;
      }

      const assignMatch = ASSIGN_RE.exec(stmt);
      if (assignMatch) assign(vars, assignMatch[1]!, assignMatch[2]!);
    }
  }

  return sites;
}

/**
 * Sorted, de-duplicated list of the literal (non-computed) addresses the program
 * POKEs into. Kept for callers that only want the bare-literal targets.
 */
export function pokeAddresses(source: string): number[] {
  const found = new Set<number>();
  for (const site of pokeSites(source)) {
    if (!site.computed) found.add(site.address);
  }
  return [...found].sort((a, b) => a - b);
}

/** Record `name = <expr>`, or forget `name` when the value can't be resolved. */
function assign(vars: Map<string, number>, name: string, expr: string): void {
  const value = evalExpr(expr, vars);
  const key = name.toUpperCase();
  if (value === undefined) vars.delete(key);
  else vars.set(key, value);
}

// --- A tiny pure numeric expression evaluator ---------------------------------
// Supports decimal literals, + - * /, unary +/-, parentheses and variable
// lookups. Anything else (functions like PEEK(...), hex &FF, ^, AND/OR, an
// unknown variable) makes the whole expression unresolvable. It returns
// `undefined` on any failure rather than throwing, matching the tokenizer's
// errors-not-throws style.

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'id'; name: string }
  | { kind: 'op'; op: '+' | '-' | '*' | '/' }
  | { kind: '('; call: boolean }
  | { kind: ')' };

/** Evaluate an address expression against known variables, or `undefined`. */
export function evalExpr(
  expr: string,
  vars: Map<string, number>,
): number | undefined {
  const tokens = tokenize(expr);
  if (!tokens) return undefined;
  const parser = { tokens, pos: 0, vars };
  const value = parseAddition(parser);
  if (value === undefined || parser.pos !== tokens.length) return undefined;
  return Number.isFinite(value) ? value : undefined;
}

function tokenize(expr: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i]!;
    if (ch === ' ' || ch === '\t') {
      i++;
    } else if (ch >= '0' && ch <= '9') {
      let j = i + 1;
      while (j < expr.length && /[0-9.]/.test(expr[j]!)) j++;
      const value = Number(expr.slice(i, j));
      if (!Number.isFinite(value)) return null;
      tokens.push({ kind: 'num', value });
      i = j;
    } else if (/[A-Za-z]/.test(ch)) {
      let j = i + 1;
      while (j < expr.length && /[A-Za-z0-9]/.test(expr[j]!)) j++;
      if (expr[j] === '$' || expr[j] === '%') j++;
      // An identifier immediately followed by `(` is a function call, which we
      // can't evaluate; flag the paren so the parser rejects it.
      const name = expr.slice(i, j).toUpperCase();
      tokens.push({ kind: 'id', name });
      i = j;
      let k = i;
      while (k < expr.length && (expr[k] === ' ' || expr[k] === '\t')) k++;
      if (expr[k] === '(') {
        tokens.push({ kind: '(', call: true });
        i = k + 1;
      }
    } else if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ kind: 'op', op: ch });
      i++;
    } else if (ch === '(') {
      tokens.push({ kind: '(', call: false });
      i++;
    } else if (ch === ')') {
      tokens.push({ kind: ')' });
      i++;
    } else {
      // ^, &, \, comparisons, anything else: unresolvable.
      return null;
    }
  }
  return tokens;
}

interface Parser {
  tokens: Token[];
  pos: number;
  vars: Map<string, number>;
}

function parseAddition(p: Parser): number | undefined {
  let left = parseTerm(p);
  if (left === undefined) return undefined;
  while (p.pos < p.tokens.length) {
    const t = p.tokens[p.pos]!;
    if (t.kind !== 'op' || (t.op !== '+' && t.op !== '-')) break;
    p.pos++;
    const right = parseTerm(p);
    if (right === undefined) return undefined;
    left = t.op === '+' ? left + right : left - right;
  }
  return left;
}

function parseTerm(p: Parser): number | undefined {
  let left = parseFactor(p);
  if (left === undefined) return undefined;
  while (p.pos < p.tokens.length) {
    const t = p.tokens[p.pos]!;
    if (t.kind !== 'op' || (t.op !== '*' && t.op !== '/')) break;
    p.pos++;
    const right = parseFactor(p);
    if (right === undefined) return undefined;
    left = t.op === '*' ? left * right : left / right;
  }
  return left;
}

function parseFactor(p: Parser): number | undefined {
  const t = p.tokens[p.pos];
  if (t && t.kind === 'op' && (t.op === '+' || t.op === '-')) {
    p.pos++;
    const inner = parseFactor(p);
    if (inner === undefined) return undefined;
    return t.op === '-' ? -inner : inner;
  }
  return parseAtom(p);
}

function parseAtom(p: Parser): number | undefined {
  const t = p.tokens[p.pos];
  if (!t) return undefined;
  if (t.kind === 'num') {
    p.pos++;
    return t.value;
  }
  if (t.kind === 'id') {
    // A function call (`id(`) is unresolvable.
    const next = p.tokens[p.pos + 1];
    if (next && next.kind === '(' && next.call) return undefined;
    p.pos++;
    return p.vars.get(t.name);
  }
  if (t.kind === '(' && !t.call) {
    p.pos++;
    const inner = parseAddition(p);
    if (inner === undefined) return undefined;
    if (p.tokens[p.pos]?.kind !== ')') return undefined;
    p.pos++;
    return inner;
  }
  return undefined;
}
