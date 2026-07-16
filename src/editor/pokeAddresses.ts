/**
 * Extracts the memory addresses a BASIC program writes into, for the memory-map
 * viewer's per-address markers and region highlight.
 *
 * A pure, dialect-agnostic editor helper in the mould of {@link ./programOutline}:
 * it walks the source line by line, blanks string literals and REM comments with
 * {@link scannable} (so `PRINT "POKE 5"` / `REM POKE 5` never match), and reads
 * the address argument of each memory write. Two write forms are understood, per
 * the dialect passed in {@link PokeContext.writes}:
 *
 * - **`poke`** (the default) - `POKE addr,val`; the address is the text up to the
 *   first comma. Used by the ZX, Commodore and TRS-80 dialects.
 * - **`indirection`** - a statement opening with `?` (byte) or `!` (word), as
 *   `?addr = val` / `!addr = val`; the address is the text up to the `=`. Used by
 *   the BBC and Atom dialects, which have no `POKE`. Only a *statement-leading*
 *   `?`/`!` is a write - a read such as `C=?addr` or `IF ?addr=5 THEN...` opens
 *   with a letter/keyword and is ignored. The dyadic `base?off=` / `base!off=`
 *   forms (which open with a variable) are not detected.
 *
 * Beyond bare literals ({@link pokeAddresses}), {@link pokeSites} also resolves
 * POKEs whose address is a variable or arithmetic expression (`POKE X,1`,
 * `POKE base+1,2`) by tracking simple `LET`/`FOR` assignments in a single pass
 * over the program in line-number order and evaluating the address expression
 * against them. A POKE inside a loop resolves to its first-iteration address
 * (the `FOR` start value).
 *
 * Resolution is best-effort and comes in two flavours, flagged per site by
 * {@link PokeSite.approximate}:
 *
 * - **Exact** - every term of the address was known (a literal or a variable we
 *   tracked to a definite value).
 * - **Approximate** - the address depends on something we can't statically pin
 *   down (an unknown/dynamic variable, or a value that comes from another
 *   operation such as `PEEK(...)` or an array element `H(C,Z)`). Rather than
 *   dropping the POKE, those unknown terms are assumed to be `0`, which resolves
 *   the *base* the expression is offset from. To keep that base meaningful, a
 *   forward constant pre-pass seeds program-wide constants first (so a base like
 *   `A=22526` defined in a `GO TO`-reached init block is known before the lines
 *   that use it), and an approximate address that collapses to `0` is dropped
 *   here; callers with a memory map drop approximate addresses that fall outside
 *   RAM (out of range or in ROM) so only plausible bases are shown.
 *
 * Anything that can't be tokenized at all (comparisons, `^`, `&`, a comma inside
 * the expression) is left out entirely.
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
  /**
   * True when the address is a best-effort *base*: some term of the expression
   * couldn't be pinned down and was assumed `0` (see the module header). Such an
   * address points at the region the POKE targets, not necessarily the exact
   * byte. Exact resolutions are `false`.
   */
  approximate: boolean;
  /**
   * Resolved end address of the range this POKE spans, when its address varies
   * with a `FOR` loop variable: the same expression re-evaluated with each loop
   * variable at its `TO` (end) value instead of its start value. Absent when the
   * POKE targets a single byte (no loop range, or the end can't be pinned down).
   * May be *less* than {@link address} for a descending (`STEP -1`) loop.
   */
  endAddress?: number;
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
  /**
   * Which memory-write statement forms this dialect uses (see the module header).
   * Defaults to `['poke']` when omitted.
   */
  writes?: ('poke' | 'indirection')[];
  /**
   * Hex-literal prefix in address expressions - BBC `'&'`, Atom `'#'`. When set,
   * `&FFFF` / `#DE` in the scanned code resolve as hex; omit for decimal-only
   * dialects. (A prefixed literal is rewritten to decimal before evaluation, so
   * such an address reports `computed: false` and its tooltip shows the decimal.)
   */
  hexPrefix?: string;
  /**
   * Statement separator, when it isn't `':'`. The Atom uses `';'`. Omit to split
   * statements on `':'`.
   */
  statementSep?: string;
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

/**
 * Rewrite `<prefix>HHHH` hex literals to their decimal value so the decimal-only
 * {@link evalExpr} can resolve BBC (`&2000`) and Atom (`#DE`) addresses without
 * teaching the expression tokenizer each machine's hex syntax. Applied to the
 * already string/REM-blanked statement text, where `&`/`#` are exclusively hex
 * prefixes on the dialects that set one. The rewrite makes an otherwise-literal
 * address report `computed: false` (its text is no longer a bare decimal) - an
 * accepted cosmetic trade for keeping the evaluator unchanged.
 */
function resolveHexLiterals(text: string, prefix: string): string {
  const re = new RegExp(
    `${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[0-9A-Fa-f]+`,
    'g',
  );
  return text.replace(re, (m) => String(parseInt(m.slice(prefix.length), 16)));
}

// POKE optionally glued to its argument the way single-keystroke / crunched
// entry allows (`POKE16384`, `POKEA`); the leading \b still stops it matching
// inside a longer word.
const POKE_RE = /\bPOKE\s*/i;
// A statement-leading `?`/`!` indirection write (BBC/Atom): the sigil, then the
// address expression, then `=`. Requiring the `=` keeps a bare read (`?A`, or a
// `?`/`!` that isn't an assignment target) from matching. Anchored at the
// statement start, so a read like `C=?A` or `IF ?A=5` - which opens with a
// letter/keyword - is never treated as a write. Group 2 is the address text.
const INDIRECTION_RE = /^\s*([?!])\s*(.*?)=/;
// A bare decimal integer - the only form counted as a non-computed literal.
const LITERAL_RE = /^\d+$/;
// [LET] VAR = ... anchored at the statement start (so `IF X=5` is not an
// assignment). The name keeps any `$`/`%` suffix so `A$` and `A` stay distinct.
const ASSIGN_RE = /^\s*(?:LET\s+)?([A-Za-z][A-Za-z0-9]*[$%]?)\s*=\s*(.*)$/i;
// FOR VAR = <start> TO <end> [STEP ...] - the start value is what a POKE in the
// body first sees; the end value gives the range's far edge (see PokeSite.endAddress).
const FOR_RE =
  /^\s*FOR\s+([A-Za-z][A-Za-z0-9]*[$%]?)\s*=\s*(.*?)\s+TO\s+(.*?)(?:\s+STEP\s+.*)?$/i;

/** A tracked variable value plus whether it was itself only approximated. */
interface VarVal {
  value: number;
  approx: boolean;
  /**
   * The value this variable reaches at the end of its `FOR` loop (the `TO`
   * value), when it is a loop counter. Set only by the FOR handler; a plain
   * assignment leaves it unset, so reassigning a loop variable clears its range.
   */
  end?: number;
  /** Whether {@link end} was itself only approximated (an unknown `TO` term). */
  endApprox?: boolean;
}

/**
 * The scannable (strings/REM blanked, UDG and hex literals resolved) statements
 * of a line, split on the dialect's statement separator. Shared by the constant
 * pre-pass and the main walk so both see the same statement stream.
 */
function statementsOf(body: string, ctx: PokeContext): string[] {
  const udgResolved =
    ctx.udgBase !== undefined ? resolveUdgCalls(body, ctx.udgBase) : body;
  const blanked = scannable(udgResolved);
  const hexResolved =
    ctx.hexPrefix !== undefined
      ? resolveHexLiterals(blanked, ctx.hexPrefix)
      : blanked;
  return hexResolved.split(ctx.statementSep ?? ':');
}

/**
 * Every POKE the program makes with an address we can resolve, in source order.
 * Addresses are not range-checked here (this helper can't see the machine's
 * address space) - callers filter against it. Approximate addresses that
 * collapse to `0` (no meaningful base) are dropped.
 */
export function pokeSites(source: string, ctx: PokeContext = {}): PokeSite[] {
  const sites: PokeSite[] = [];
  const writes = ctx.writes ?? ['poke'];

  // Program order, not physical order: the value tracker models execution.
  const lines = parseLines(source).sort((a, b) => a.lineNo - b.lineNo);

  // Seed program-wide constants first, so a base defined below the lines that
  // use it (e.g. an init block reached via `GO TO`) is already known.
  const vars = seedConstants(lines, ctx);

  // Resolve one write's address expression to a site, or `null` when it can't be
  // pinned down (unresolvable, or an approximate base collapsing to 0). `label`
  // is the text kept for the tooltip - the bare expression for POKE, the sigil +
  // expression for indirection. Shared by both write forms.
  const siteFor = (
    expr: string,
    label: string,
    lineNo: number,
  ): PokeSite | null => {
    const value = evalExpr(expr, vars);
    if (value === undefined) return null;
    const address = Math.round(value.value);
    // An approximate address that lands on 0 has no meaningful base - every term
    // of the expression was unknown - so drop it here.
    if (value.approx && address === 0) return null;
    return {
      address,
      expr: label,
      computed: !LITERAL_RE.test(expr),
      approximate: value.approx,
      lineNo,
      ...rangeEnd(expr, vars, address, value.approx),
    };
  };

  for (const line of lines) {
    for (const stmt of statementsOf(line.body, ctx)) {
      const forMatch = FOR_RE.exec(stmt);
      if (forMatch) {
        assignFor(vars, forMatch[1]!, forMatch[2]!, forMatch[3]!);
        continue;
      }

      const pokeMatch = writes.includes('poke') ? POKE_RE.exec(stmt) : null;
      if (pokeMatch) {
        const rest = stmt.slice(pokeMatch.index + pokeMatch[0].length);
        const comma = rest.indexOf(',');
        const expr = (comma === -1 ? rest : rest.slice(0, comma)).trim();
        const site = siteFor(expr, expr, line.lineNo);
        if (site) sites.push(site);
        continue;
      }

      const indMatch = writes.includes('indirection')
        ? INDIRECTION_RE.exec(stmt)
        : null;
      if (indMatch) {
        const expr = indMatch[2]!.trim();
        // Tooltip keeps the sigil so a marker reads `?&2000` / `!DE`, not a bare
        // address. Word (`!`) writes mark only their low byte.
        const site = siteFor(expr, `${indMatch[1]}${expr}`, line.lineNo);
        if (site) sites.push(site);
        continue;
      }

      const assignMatch = ASSIGN_RE.exec(stmt);
      if (assignMatch) assign(vars, assignMatch[1]!, assignMatch[2]!);
    }
  }

  return sites;
}

/**
 * Variables the whole program assigns exactly once, to an expression that folds
 * to a definite constant. These are safe to know everywhere (their value never
 * varies), so seeding them up front lets a POKE resolve against a base defined
 * later in the listing than the POKE itself - the common `GO TO <init>` idiom.
 *
 * Multiply-assigned or dynamic variables are deliberately excluded, so genuinely
 * changing values stay unknown and fall to the approximate `0` assumption.
 * Evaluated to a fixpoint so a constant defined from an earlier constant
 * (`LET W=FL+1`) still resolves regardless of listing order.
 */
function seedConstants(
  lines: { lineNo: number; body: string }[],
  ctx: PokeContext,
): Map<string, VarVal> {
  // The single assignment expression per variable, or a "seen twice" marker.
  const single = new Map<string, string>();
  const multi = new Set<string>();
  const note = (name: string, expr: string) => {
    const key = name.toUpperCase();
    if (multi.has(key)) return;
    if (single.has(key)) {
      single.delete(key);
      multi.add(key);
    } else single.set(key, expr);
  };

  for (const line of lines) {
    for (const stmt of statementsOf(line.body, ctx)) {
      const forMatch = FOR_RE.exec(stmt);
      if (forMatch) {
        note(forMatch[1]!, forMatch[2]!);
        continue;
      }
      const assignMatch = ASSIGN_RE.exec(stmt);
      if (assignMatch) note(assignMatch[1]!, assignMatch[2]!);
    }
  }

  const seed = new Map<string, VarVal>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [key, expr] of single) {
      if (seed.has(key)) continue;
      const value = evalExpr(expr, seed);
      // Only exact folds qualify; an approximate result means it depends on
      // something dynamic and must not be treated as a constant.
      if (value !== undefined && !value.approx) {
        seed.set(key, { value: value.value, approx: false });
        changed = true;
      }
    }
  }
  return seed;
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
function assign(vars: Map<string, VarVal>, name: string, expr: string): void {
  const value = evalExpr(expr, vars);
  const key = name.toUpperCase();
  if (value === undefined) vars.delete(key);
  else vars.set(key, value);
}

/**
 * Record a `FOR name = <start> TO <end>` loop: the counter takes its start value
 * (what a POKE in the body first sees), and its {@link VarVal.end} carries the
 * `TO` value so a POKE's range can be resolved. An unresolvable start forgets the
 * variable; an unresolvable end just leaves the range unknown.
 */
function assignFor(
  vars: Map<string, VarVal>,
  name: string,
  startExpr: string,
  endExpr: string,
): void {
  const start = evalExpr(startExpr, vars);
  const key = name.toUpperCase();
  if (start === undefined) {
    vars.delete(key);
    return;
  }
  // Evaluate the TO value with useEnd, so `FOR J=... TO B+384` picks up any
  // outer loop's end too - keeping nested ranges consistent.
  const end = evalExpr(endExpr, vars, true);
  vars.set(key, {
    value: start.value,
    approx: start.approx,
    ...(end !== undefined ? { end: end.value, endApprox: end.approx } : {}),
  });
}

/**
 * The `{ endAddress }` to spread onto a {@link PokeSite}, or `{}` when the POKE
 * targets a single byte. Re-evaluates the address expression with each loop
 * counter at its `TO` value ({@link evalExpr}'s `useEnd`) and keeps the result
 * only when it is a genuine, meaningful range:
 * - the end resolves, and rounds to a different address than the start; and
 * - it isn't an approximate base collapsing to 0 (no meaningful edge); and
 * - it isn't approximate while the start is exact - the `FOR I=1 TO N` (unknown
 *   `N` -> 0) case, which would otherwise draw a bogus descending band.
 */
function rangeEnd(
  expr: string,
  vars: Map<string, VarVal>,
  address: number,
  startApprox: boolean,
): { endAddress?: number } {
  const end = evalExpr(expr, vars, true);
  if (end === undefined) return {};
  const endAddress = Math.round(end.value);
  if (endAddress === address) return {};
  if (end.approx && endAddress === 0) return {};
  if (end.approx && !startApprox) return {};
  return { endAddress };
}

// --- A tiny pure numeric expression evaluator ---------------------------------
// Supports decimal literals, + - * /, unary +/-, parentheses and variable
// lookups. An unknown variable or a function/array call (`PEEK(...)`, `H(C,Z)`)
// is assumed to be `0` and flags the result approximate, so the resolvable base
// of the expression still comes through. Anything that can't be tokenized (hex
// `&FF`, `^`, `AND`/`OR`, comparisons, a comma) makes the whole expression
// unresolvable. It returns `undefined` on that failure rather than throwing,
// matching the tokenizer's errors-not-throws style.

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'id'; name: string }
  | { kind: 'op'; op: '+' | '-' | '*' | '/' }
  | { kind: '('; call: boolean }
  | { kind: ')' };

/**
 * Evaluate an address expression against known variables. Returns the resolved
 * value together with whether any unknown term had to be assumed `0`
 * (`approx`), or `undefined` when the expression can't be tokenized/parsed at
 * all.
 *
 * With `useEnd` set, a loop counter is read at its {@link VarVal.end} value (the
 * `FOR ... TO` value) rather than its start value, so the same expression yields
 * the range's far edge. Variables without an `end` are read normally.
 */
export function evalExpr(
  expr: string,
  vars: Map<string, VarVal>,
  useEnd = false,
): VarVal | undefined {
  const tokens = tokenize(expr);
  if (!tokens) return undefined;
  const parser: Parser = { tokens, pos: 0, vars, approx: false, useEnd };
  const value = parseAddition(parser);
  if (value === undefined || parser.pos !== tokens.length) return undefined;
  return Number.isFinite(value) ? { value, approx: parser.approx } : undefined;
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
  vars: Map<string, VarVal>;
  /** Set once any unknown term was assumed `0`, marking the value a base. */
  approx: boolean;
  /** Read loop counters at their `FOR ... TO` value (see {@link evalExpr}). */
  useEnd: boolean;
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
    const next = p.tokens[p.pos + 1];
    // A function/array call (`id(`) - `PEEK(x)`, `H(C,Z)` - has a value we
    // can't compute; assume 0 and mark the result approximate.
    if (next && next.kind === '(' && next.call) {
      p.pos++; // past the id, onto the '('
      if (!skipParens(p)) return undefined; // unbalanced: give up
      p.approx = true;
      return 0;
    }
    p.pos++;
    const v = p.vars.get(t.name);
    // Unknown variable: assume 0, flag approximate. A known-but-approximate
    // variable propagates its approximate-ness.
    if (v === undefined) {
      p.approx = true;
      return 0;
    }
    // When resolving a range's far edge, read a loop counter at its TO value.
    if (p.useEnd && v.end !== undefined) {
      if (v.endApprox) p.approx = true;
      return v.end;
    }
    if (v.approx) p.approx = true;
    return v.value;
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

/**
 * Consume a balanced parenthesised group starting at the current `(` token
 * (call or not), advancing `pos` past the matching `)`. Returns false if the
 * parens are unbalanced (the caller then bails).
 */
function skipParens(p: Parser): boolean {
  let depth = 0;
  while (p.pos < p.tokens.length) {
    const t = p.tokens[p.pos]!;
    if (t.kind === '(') depth++;
    else if (t.kind === ')') {
      depth--;
      if (depth === 0) {
        p.pos++;
        return true;
      }
    }
    p.pos++;
  }
  return false;
}
