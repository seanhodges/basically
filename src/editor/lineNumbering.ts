/**
 * Pure helpers for automatic BASIC line numbering.
 *
 * BASIC programs are a list of strictly-ascending numbered lines. These
 * functions compute the number a freshly-inserted line should get, cascade
 * existing numbers to free up space, and rewrite line-number references
 * (GOTO/GOSUB/RUN/LIST/LLIST) when a line is renumbered. They operate purely
 * on strings/numbers so the editor and the tests can share them.
 */

import {
  binaryRecordInfo,
  isBinaryDirective,
  parseBinaryDirective,
} from '../dialects/binaryDirective';

export interface BasicLine {
  /** Parsed line number, 1..9999. */
  lineNo: number;
  /** Text after the line number and its single optional separating space. */
  body: string;
  /** Original trimmed line text. */
  raw: string;
}

export const MIN_LINE_NO = 1;
export const MAX_LINE_NO = 65535;

/**
 * The active dialect's reading of a physical line it takes without a line
 * number - the commands an Apple I listing opens and closes with. See
 * {@link Dialect.unnumberedLineKey}, which is where this comes from.
 *
 * Every function here takes it optionally and defaults to not having one, so a
 * machine whose source is numbered lines and nothing else numbers, renumbers
 * and re-emits exactly as it always did.
 */
export type UnnumberedLine = (lineText: string) => boolean;

/**
 * True when a line must keep its place and its text through a numbering
 * operation: an opaque `#BIN` payload, or a line the dialect takes unnumbered.
 * Numbering either one changes what it means.
 */
function isKept(line: string, keep?: UnnumberedLine): boolean {
  return isBinaryDirective(line) || (keep?.(line) ?? false);
}

/**
 * Regex fragments for keywords whose immediately-following integer literal is a
 * line reference. `GO\s*TO` / `GO\s*SUB` cover both the joined (`GOTO`) and
 * Sinclair-spaced (`GO TO`) spellings; `THEN`/`ELSE`/`RESTORE` are line targets
 * too but only when a number follows (the scanner requires `\d+`), so
 * `THEN PRINT` is left untouched. Longer alternatives come first so, e.g.,
 * `LLIST` wins over `LIST`.
 */
const REF_KEYWORDS = [
  'GO\\s*TO',
  'GO\\s*SUB',
  'RESTORE',
  'LLIST',
  'LIST',
  'THEN',
  'ELSE',
  'RUN',
];

/** Keywords after which a comma-separated list of line numbers may follow
 * (`ON X GOTO 10,20,30`). Compared against the matched keyword with spaces
 * stripped and upper-cased. */
const LIST_KEYWORDS = new Set(['GOTO', 'GOSUB']);

/**
 * Parse source into ordered numbered lines. Blank lines and lines without a
 * leading number are skipped (the latter are in-progress / not reference-able).
 */
export function parseLines(source: string): BasicLine[] {
  const result: BasicLine[] = [];
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    const m = /^(\d+)\s?/.exec(line);
    if (!m) continue;
    result.push({
      lineNo: parseInt(m[1]!, 10),
      body: line.slice(m[0].length),
      raw: line,
    });
  }
  return result;
}

/**
 * Compute the number for a line being inserted between `prev` and `next`
 * (either may be null at the document edges).
 *
 * - End of file: previous + increment (an empty file starts at `increment`).
 * - Top of file: half of the following line, rounded down.
 * - Between two lines: the midpoint rounded down, unless the two are adjacent
 *   (no integer gap), in which case `makeSpace` is signalled and the freed slot
 *   `prev + 1` is returned for the caller to use after cascading.
 */
export function computeNewLineNumber(
  prev: number | null,
  next: number | null,
  increment: number,
): { lineNo: number; makeSpace: boolean } {
  if (next === null) {
    return { lineNo: (prev ?? 0) + increment, makeSpace: false };
  }
  if (prev === null) {
    const mid = Math.floor(next / 2);
    if (mid < MIN_LINE_NO) return { lineNo: MIN_LINE_NO, makeSpace: true };
    return { lineNo: mid, makeSpace: false };
  }
  const mid = Math.floor((prev + next) / 2);
  if (mid > prev && mid < next) return { lineNo: mid, makeSpace: false };
  return { lineNo: prev + 1, makeSpace: true };
}

/**
 * Cascade existing line numbers upward to free the slot `afterLineNo + 1`.
 * Walks the lines following `afterLineNo`, bumping each one that collides with
 * the required next slot until a natural gap is reached. Returns an old→new map
 * for every line that must move (empty if nothing needs to move, or if the
 * cascade would exceed MAX_LINE_NO - in which case the caller should abort).
 */
export function makeSpace(
  lines: BasicLine[],
  afterLineNo: number,
  increment: number,
): Map<number, number> {
  void increment; // single-slot cascade; increment kept for signature symmetry
  const map = new Map<number, number>();
  let expected = afterLineNo + 1; // slot we want freed; each line may only sit above it
  for (const line of lines) {
    if (line.lineNo <= afterLineNo) continue;
    if (line.lineNo > expected) break; // a gap exists at `expected`; cascade done
    const next = expected + 1;
    if (next > MAX_LINE_NO) return new Map(); // no room - caller aborts
    map.set(line.lineNo, next);
    expected = next;
  }
  return map;
}

/**
 * Cascade existing line numbers upward to free `count` consecutive slots
 * starting at `afterLineNo + 1` (the generalisation of {@link makeSpace}, which
 * frees a single slot). Walks the lines following `afterLineNo`, bumping each
 * one that would sit inside the reserved run up to the next free number, until a
 * natural gap is reached. Returns an old→new map for every line that must move
 * (empty when nothing needs to move), or null when the cascade would exceed
 * MAX_LINE_NO so the caller can abort.
 */
export function makeSpaceN(
  lines: BasicLine[],
  afterLineNo: number,
  count: number,
): Map<number, number> | null {
  const map = new Map<number, number>();
  let expected = afterLineNo + count + 1; // lowest slot a following line may keep
  for (const line of lines) {
    if (line.lineNo <= afterLineNo) continue;
    if (line.lineNo >= expected) break; // a gap exists from here up; cascade done
    if (expected > MAX_LINE_NO) return null; // no room - caller aborts
    map.set(line.lineNo, expected);
    expected += 1;
  }
  return map;
}

/** Line numbers planned for a multi-line construct expansion. */
export interface ConstructNumbering {
  /**
   * Number to assign the current line when it carried none (the caller prefixes
   * `"<n> "` onto it); null when the current line already had a number.
   */
  currentLineNo: number | null;
  /** Line numbers for each continuation line, in order. */
  continuationNos: number[];
  /** old→new shifts for following lines to free room (empty when none needed). */
  cascade: Map<number, number>;
}

/**
 * Plan the line numbers for expanding a multi-line code construct on physical
 * line `idx`, which needs `extra` continuation lines below it. Mirrors
 * {@link insertNumberedLineBelow} but reserves `extra` consecutive slots: it
 * bootstraps the current line's number when absent, prefers increment-spaced
 * numbers when the gap to the next line allows, and otherwise falls back to
 * unit spacing after cascading the following lines via {@link makeSpaceN}.
 * Returns null when numbering can't fit (so the caller inserts the bare keyword
 * instead).
 */
export function planConstructNumbering(
  physical: string[],
  idx: number,
  increment: number,
  extra: number,
  keep?: UnnumberedLine,
): ConstructNumbering | null {
  if (extra <= 0)
    return { currentLineNo: null, continuationNos: [], cascade: new Map() };
  // Never bootstrap a line number onto a line that must not carry one.
  if (isKept(physical[idx]!, keep)) return null;

  const { prev, next: nextNo } = neighbours(physical, idx);

  // Resolve the current line's number, bootstrapping one if it has none.
  let currentLineNo: number | null = null;
  let baseNo = lineNumberOf(physical[idx]!);
  if (baseNo === null) {
    const r = computeNewLineNumber(prev, nextNo, increment);
    if (r.makeSpace) return null; // no room even for the current line - bail
    baseNo = r.lineNo;
    currentLineNo = r.lineNo;
  }

  // Prefer increment-spaced numbers; fall back to unit spacing + a cascade.
  const idealLast = baseNo + extra * increment;
  if (nextNo === null || idealLast < nextNo) {
    const continuationNos = Array.from(
      { length: extra },
      (_, k) => baseNo! + (k + 1) * increment,
    );
    return { currentLineNo, continuationNos, cascade: new Map() };
  }
  const cascade = makeSpaceN(parseLines(physical.join('\n')), baseNo, extra);
  if (cascade === null) return null;
  const continuationNos = Array.from(
    { length: extra },
    (_, k) => baseNo! + k + 1,
  );
  return { currentLineNo, continuationNos, cascade };
}

/**
 * Rewrite line-number references (GOTO/GOSUB/RUN/LIST/LLIST targets) according
 * to `remap`. Numbers inside strings and after REM are left untouched, as are
 * computed targets (e.g. `GOTO X+1`) since only literal integers are matched.
 */
export function rewriteReferences(
  source: string,
  remap: Map<number, number>,
): string {
  if (remap.size === 0) return source;
  return source
    .split('\n')
    .map((line) => rewriteLineReferences(line, remap))
    .join('\n');
}

/** Rewrite references within a single physical line, skipping strings/REM. */
function rewriteLineReferences(
  line: string,
  remap: Map<number, number>,
): string {
  // A #BIN payload is opaque bytes; base64 can spell `RUN12`/`GoTo9`, which
  // must never be rewritten.
  if (isBinaryDirective(line)) return line;
  const refRe = new RegExp(`(${REF_KEYWORDS.join('|')})(\\s*)(\\d+)`, 'gi');
  // Continuation for comma-separated line lists: matches ",<n>" incl. surrounding
  // whitespace; group 1 is the separator up to the digits, group 2 the number.
  const listRe = /(\s*,\s*)(\d+)/g;
  let out = '';
  let i = 0;
  let inString = false;
  while (i < line.length) {
    const ch = line[i]!;
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
    // REM at a statement boundary: the rest of the line is a comment.
    if (/[Rr]/.test(ch) && /^rem\b/i.test(line.slice(i))) {
      out += line.slice(i);
      break;
    }
    // Try a reference keyword anchored here.
    refRe.lastIndex = i;
    const m = refRe.exec(line);
    if (m && m.index === i) {
      const target = parseInt(m[3]!, 10);
      const replacement = remap.get(target);
      out += replacement === undefined ? m[0] : `${m[1]}${m[2]}${replacement}`;
      i += m[0].length;
      // `ON X GOTO 10,20,30` - keep remapping comma-separated targets.
      if (LIST_KEYWORDS.has(m[1]!.replace(/\s+/g, '').toUpperCase())) {
        listRe.lastIndex = i;
        let lm: RegExpExecArray | null;
        while ((lm = listRe.exec(line)) && lm.index === i) {
          const n = parseInt(lm[2]!, 10);
          const rep = remap.get(n);
          out += rep === undefined ? lm[0] : `${lm[1]}${rep}`;
          i += lm[0].length;
          listRe.lastIndex = i;
        }
      }
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * Apply a whole old→new shift map atomically: rewrite each moved line's own
 * number and every reference in one pass (against the original numbers, so a
 * 12→13/13→14 cascade is never double-applied), then re-sort ascending.
 */
export function applyRenumberMap(
  source: string,
  map: Map<number, number>,
  keep?: UnnumberedLine,
): string {
  if (map.size === 0) return source;
  const referenced = rewriteReferences(source, map);
  const lines = parseLines(referenced).map((l) => {
    const moved = map.get(l.lineNo);
    return { ...l, lineNo: moved ?? l.lineNo };
  });
  return joinLines(lines, carriedLines(referenced, keep, map));
}

/**
 * Renumber a single line from `oldNo` to `newNo`, rewriting all references to
 * it, then re-sorting the program into ascending order. No-op if `oldNo` is
 * absent or `oldNo === newNo`.
 */
export function renumberLine(
  source: string,
  oldNo: number,
  newNo: number,
  keep?: UnnumberedLine,
): string {
  if (oldNo === newNo) return source;
  const lines = parseLines(source);
  if (!lines.some((l) => l.lineNo === oldNo)) return source;
  const remap = new Map([[oldNo, newNo]]);
  const referenced = rewriteReferences(source, remap);
  const renumbered = parseLines(referenced).map((l) =>
    l.lineNo === oldNo ? { ...l, lineNo: newNo } : l,
  );
  return joinLines(renumbered, carriedLines(referenced, keep, remap));
}

/**
 * Renumber the whole program to `start, start+increment, start+2*increment, …`
 * in source order, rewriting every line-number reference to match. Every
 * non-blank line becomes a numbered line - text lines that lacked a number are
 * given one (not dropped) - while blank lines are removed, so the result is a
 * clean numbered listing. Returns `null` if the highest resulting number would
 * exceed {@link MAX_LINE_NO} - the caller should surface that and abort. An
 * empty program (only blank lines) is returned unchanged.
 *
 * A line the dialect takes unnumbered is the exception, alongside a `#BIN`
 * directive: it keeps its place and its text. Its *references* are still
 * rewritten, so a listing closing with `RUN 100` follows the renumber to
 * whatever 100 became.
 */
export function renumberProgram(
  source: string,
  start: number,
  increment: number,
  keep?: UnnumberedLine,
): string | null {
  const rows = source
    .split('\n')
    .map((raw) => raw.trim())
    .filter((row) => row !== '');
  if (rows.length === 0) return source;

  // Kept lines hold their place and their text - renumbering must never touch
  // an opaque payload, nor put a number on a line whose machine has none.
  const renumberable = rows.filter((row) => !isKept(row, keep));
  if (renumberable.length === 0) return rows.join('\n');
  const highest = start + (renumberable.length - 1) * increment;
  if (highest > MAX_LINE_NO) return null;

  // Map each already-numbered line to its new number so references remap too.
  // Unnumbered lines have no old number to reference, so they need no entry.
  const remap = new Map<number, number>();
  let n = 0;
  rows.forEach((row) => {
    if (isKept(row, keep)) return;
    const oldNo = lineNumberOf(row);
    if (oldNo !== null) remap.set(oldNo, start + n * increment);
    n++;
  });

  let k = 0;
  return rows
    .map((row) => {
      if (isBinaryDirective(row)) return row;
      if (keep?.(row)) return rewriteReferences(row, remap);
      const newNo = start + k++ * increment;
      const refd = rewriteReferences(row, remap);
      // Strip the old leading number when present; unnumbered lines keep their
      // full text (they can't start with a digit, or they'd have been numbered).
      const body =
        lineNumberOf(row) === null ? refd : refd.replace(/^\d+\s?/, '');
      return body === '' ? `${newNo}` : `${newNo} ${body}`;
    })
    .join('\n');
}

/** A line a re-emit must carry, with the number it sorts by. */
interface CarriedLine {
  /** A `#BIN` record's own number, or the number an unnumbered line sits above. */
  lineNo: number;
  /** -1 for a line the dialect takes unnumbered, 0 for a `#BIN` directive. */
  pri: number;
  raw: string;
}

/**
 * Collect the lines of a source that `parseLines` cannot represent, in order,
 * each with the number it should sort by. Both kinds lack a leading digit, so
 * `parseLines` skips them and re-emitting flows must carry them separately.
 *
 * A `#BIN` directive sorts by its own embedded record number (0 for a malformed
 * payload). A line the dialect takes unnumbered has no number of its own, so it
 * sorts by the one it sits *above* - a preamble rides with the first line of the
 * program wherever renumbering moves it, and a listing's trailing `RUN`, with no
 * numbered line below it, stays at the foot.
 */
function carriedLines(
  source: string,
  keep?: UnnumberedLine,
  remap?: Map<number, number>,
): CarriedLine[] {
  const rows = source.split('\n').map((raw) => raw.trim());
  const out: CarriedLine[] = [];
  for (let i = 0; i < rows.length; i++) {
    const line = rows[i]!;
    if (line === '') continue;
    if (isBinaryDirective(line)) {
      const parsed = parseBinaryDirective(line);
      const lineNo =
        parsed && 'record' in parsed
          ? binaryRecordInfo(parsed.record).lineNo
          : 0;
      out.push({ lineNo, pri: 0, raw: line });
      continue;
    }
    if (!keep?.(line)) continue;
    let anchor = Number.POSITIVE_INFINITY;
    for (let j = i + 1; j < rows.length; j++) {
      const no = lineNumberOf(rows[j]!);
      if (no !== null) {
        anchor = remap?.get(no) ?? no;
        break;
      }
    }
    out.push({ lineNo: anchor, pri: -1, raw: line });
  }
  return out;
}

/**
 * Re-emit parsed lines as "<lineNo> <body>", sorted ascending by number,
 * merging the carried lines back in by their sort number - a carried line
 * sorts before an equal-numbered text line, and duplicates keep their original
 * relative order (real files repeat binary line numbers).
 */
function joinLines(lines: BasicLine[], carried: CarriedLine[] = []): string {
  const entries = [
    ...carried.map((d) => ({ no: d.lineNo, pri: d.pri, text: d.raw })),
    ...lines.map((l) => ({
      no: l.lineNo,
      pri: 1,
      text: l.body === '' ? `${l.lineNo}` : `${l.lineNo} ${l.body}`,
    })),
  ];
  entries.sort((a, b) => a.no - b.no || a.pri - b.pri);
  return entries.map((e) => e.text).join('\n');
}

/** Leading line number of a physical line, or null if it has none. */
function lineNumberOf(physical: string): number | null {
  const m = /^\s*(\d+)\s?/.exec(physical);
  return m ? parseInt(m[1]!, 10) : null;
}

/** Nearest numbered lines immediately above and below physical index `idx`. */
function neighbours(
  physical: string[],
  idx: number,
): {
  prev: number | null;
  next: number | null;
} {
  let prev: number | null = null;
  for (let i = idx - 1; i >= 0; i--) {
    const n = lineNumberOf(physical[i]!);
    if (n !== null) {
      prev = n;
      break;
    }
  }
  let next: number | null = null;
  for (let i = idx + 1; i < physical.length; i++) {
    const n = lineNumberOf(physical[i]!);
    if (n !== null) {
      next = n;
      break;
    }
  }
  return { prev, next };
}

/**
 * Apply an old→new shift map to physical lines, preserving structure (blank and
 * unnumbered lines are kept in place, unlike {@link applyRenumberMap}). Rewrites
 * each numbered line's own prefix and any references, against the original
 * numbers in a single pass.
 */
export function applyMapToPhysical(
  physical: string[],
  map: Map<number, number>,
): string[] {
  return physical.map((raw) => {
    const refd = rewriteReferences(raw, map);
    const m = /^(\s*)(\d+)(\s?)([\s\S]*)$/.exec(refd);
    if (!m) return refd;
    const mapped = map.get(parseInt(m[2]!, 10));
    return mapped === undefined ? refd : `${m[1]}${mapped}${m[3]}${m[4]}`;
  });
}

/**
 * Give the text-bearing physical line at `idx` a position-appropriate number
 * when it lacks one, cascading following lines via {@link makeSpace} if there
 * is no gap. A line that already has a number is returned untouched. Returns the
 * (possibly cascaded) lines and the line's number, or null when the line is
 * blank or no number can be fitted (an overflowing cascade).
 */
export function numberLineInPlace(
  physical: string[],
  idx: number,
  increment: number,
  keep?: UnnumberedLine,
): { lines: string[]; lineNo: number } | null {
  let lines = [...physical];
  const cur = lines[idx]!.trim();
  if (cur === '' || isKept(cur, keep)) return null;

  const existing = lineNumberOf(lines[idx]!);
  if (existing !== null) return { lines, lineNo: existing };

  const { prev, next } = neighbours(lines, idx);
  const r = computeNewLineNumber(prev, next, increment);
  if (r.makeSpace) {
    const map = makeSpace(parseLines(lines.join('\n')), prev ?? 0, increment);
    if (map.size === 0) return null;
    lines = applyMapToPhysical(lines, map);
  }
  lines[idx] = `${r.lineNo} ${cur}`;
  return { lines, lineNo: r.lineNo };
}

export interface InsertResult {
  /** New physical lines. */
  lines: string[];
  /** 0-based index of the inserted line (cursor should land at its end). */
  cursorLine: number;
}

/**
 * Insert an automatically-numbered line below physical index `idx` (where Enter
 * was pressed at the end of the line). If the current line has text but no
 * number it is numbered in place first (this bootstraps the very first line of
 * a file). Cascades existing numbers via {@link makeSpace} when there is no gap.
 * Returns null when numbering should be skipped (blank current line, or a
 * cascade that would overflow 9999) so the caller can fall back to a plain
 * newline.
 */
export function insertNumberedLineBelow(
  physical: string[],
  idx: number,
  increment: number,
  keep?: UnnumberedLine,
): InsertResult | null {
  // 1. Ensure the current line has text and carries a number.
  const bootstrapped = numberLineInPlace(physical, idx, increment, keep);
  if (!bootstrapped) return null;
  let lines = bootstrapped.lines;
  const curNo = bootstrapped.lineNo;

  // 2. Number the new line being inserted below the current one.
  const { next } = neighbours(lines, idx);
  const r = computeNewLineNumber(curNo, next, increment);
  let newNo = r.lineNo;
  if (r.makeSpace) {
    const map = makeSpace(parseLines(lines.join('\n')), curNo, increment);
    if (map.size === 0) return null;
    lines = applyMapToPhysical(lines, map);
    newNo = curNo + 1;
  }

  lines.splice(idx + 1, 0, `${newNo} `);
  return { lines, cursorLine: idx + 1 };
}
