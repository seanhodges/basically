/**
 * Builds a navigable outline of a BASIC program: the destinations a reader
 * would want to jump to — named procedure/function definitions and the line
 * numbers that GOSUB/GOTO point *at* (entry points), never the call sites.
 *
 * Like {@link ./lineNumbering}, this is a pure, dialect-agnostic editor helper.
 * Which constructs to look for is decided from the dialect's declared keywords
 * (see {@link outlineCapabilities}); the extraction itself uses fixed regexes
 * tolerant of the Sinclair `GO TO`/`GO SUB` spellings. String literals and the
 * text after REM are skipped so `PRINT "GOTO 50"` / `REM SEE GOSUB 100` never
 * produce phantom entries.
 */
import type { EditorKeyword } from '../dialects/types';
import { parseLines, type BasicLine } from './lineNumbering';

export type OutlineKind = 'procedure' | 'function' | 'subroutine' | 'goto';

export interface OutlineItem {
  kind: OutlineKind;
  /** Text shown in the outline (proc/fn name, a nearby REM, or the line body). */
  title: string;
  /** BASIC line number to jump to. */
  lineNo: number;
}

export interface OutlineSection {
  kind: OutlineKind;
  heading: string;
  items: OutlineItem[];
}

export interface OutlineCapabilities {
  hasProc: boolean;
  hasFn: boolean;
  hasGosub: boolean;
  hasGoto: boolean;
}

/** Longest title kept before it is truncated with an ellipsis. */
const MAX_TITLE = 60;

/** Normalize a keyword spelling for capability matching ("GO SUB" -> "GOSUB"). */
function normalize(word: string): string {
  return word.replace(/\s+/g, '').toUpperCase();
}

/**
 * Decide which outline sections a dialect can produce from its keyword set.
 * Sinclair machines expose GOSUB/GOTO (and ZX Spectrum DEF FN); BBC machines
 * add PROC. We read presence only — the source spellings drive the regexes.
 */
export function outlineCapabilities(
  keywords: EditorKeyword[],
): OutlineCapabilities {
  const words = new Set(keywords.map((k) => normalize(k.word)));
  return {
    hasProc: words.has('PROC'),
    hasFn: words.has('FN') || words.has('DEFFN'),
    hasGosub: words.has('GOSUB'),
    hasGoto: words.has('GOTO'),
  };
}

/**
 * Return the part of a line body that is real code: everything before a REM
 * statement, with string-literal contents blanked to spaces so keywords and
 * numbers inside them are never matched. Mirrors the string/REM skipping in
 * {@link ./lineNumbering}'s rewriteLineReferences.
 */
export function scannable(body: string): string {
  let out = '';
  let i = 0;
  let inString = false;
  while (i < body.length) {
    const ch = body[i]!;
    if (inString) {
      out += ' ';
      if (ch === '"') inString = false;
      i++;
      continue;
    }
    if (ch === '"') {
      out += ' ';
      inString = true;
      i++;
      continue;
    }
    // REM at a statement boundary: the rest of the line is a comment.
    if (/[Rr]/.test(ch) && /^rem\b/i.test(body.slice(i))) break;
    out += ch;
    i++;
  }
  return out;
}

/** Comment text of a REM-only line (after the REM keyword), or null. */
function remText(line: BasicLine | undefined): string | null {
  if (!line) return null;
  const m = /^\s*REM\b\s?(.*)$/i.exec(line.body);
  if (!m) return null;
  const t = m[1]!.trim();
  return t === '' ? null : t;
}

/** Truncate to {@link MAX_TITLE}, appending an ellipsis when shortened. */
function truncate(text: string): string {
  return text.length > MAX_TITLE ? `${text.slice(0, MAX_TITLE - 1)}…` : text;
}

/**
 * Title for a GOSUB/GOTO target line (which has no name): a REM on the target
 * line, else the line directly above, else directly below; falling back to the
 * target line's own body.
 */
function titleForTarget(lines: BasicLine[], idx: number): string {
  const here = lines[idx]!;
  const rem =
    remText(here) ?? remText(lines[idx - 1]) ?? remText(lines[idx + 1]);
  return truncate(rem ?? (here.body.trim() || `Line ${here.lineNo}`));
}

/** Collect every literal line number after a GOSUB/GOTO (incl. ON ... lists). */
function collectTargets(scan: string, re: RegExp, into: Set<number>): void {
  for (const m of scan.matchAll(re)) {
    for (const n of m[1]!.match(/\d+/g) ?? []) into.add(parseInt(n, 10));
  }
}

/**
 * Build the program outline. Sections with no items are omitted. Capabilities
 * gate which sections are even considered, so a Sinclair program never reports
 * procedures/functions.
 */
export function buildOutline(
  source: string,
  caps: OutlineCapabilities,
): OutlineSection[] {
  const lines = parseLines(source);
  const indexByLineNo = new Map<number, number>();
  lines.forEach((l, i) => indexByLineNo.set(l.lineNo, i));

  const procedures: OutlineItem[] = [];
  const functions: OutlineItem[] = [];
  const gosubTargets = new Set<number>();
  const gotoTargets = new Set<number>();

  // GOSUB / GOTO with an optional internal space, followed by a literal number
  // or a comma-separated list (ON n GOTO a,b,c). Computed targets (GOTO X) have
  // no leading digit and are skipped.
  const gosubRe = /\bGO\s?SUB\b\s*((?:\d+\s*,\s*)*\d+)/gi;
  const gotoRe = /\bGO\s?TO\b\s*((?:\d+\s*,\s*)*\d+)/gi;
  const procRe = /\bDEF\s*PROC([A-Za-z0-9_]+)/gi;
  const fnRe = /\bDEF\s*FN([A-Za-z0-9_]+)/gi;

  for (const line of lines) {
    const scan = scannable(line.body);
    if (caps.hasProc) {
      for (const m of scan.matchAll(procRe))
        procedures.push({
          kind: 'procedure',
          title: `PROC${m[1]}`,
          lineNo: line.lineNo,
        });
    }
    if (caps.hasFn) {
      for (const m of scan.matchAll(fnRe))
        functions.push({
          kind: 'function',
          title: `FN${m[1]}`,
          lineNo: line.lineNo,
        });
    }
    if (caps.hasGosub) collectTargets(scan, gosubRe, gosubTargets);
    if (caps.hasGoto) collectTargets(scan, gotoRe, gotoTargets);
  }

  const targetItems = (
    targets: Set<number>,
    kind: OutlineKind,
  ): OutlineItem[] =>
    [...targets]
      .filter((n) => indexByLineNo.has(n))
      .sort((a, b) => a - b)
      .map((n) => ({
        kind,
        title: titleForTarget(lines, indexByLineNo.get(n)!),
        lineNo: n,
      }));

  const sections: OutlineSection[] = [
    { kind: 'procedure', heading: 'Procedures', items: procedures },
    { kind: 'function', heading: 'Functions', items: functions },
    {
      kind: 'subroutine',
      heading: 'Subroutines',
      items: targetItems(gosubTargets, 'subroutine'),
    },
    { kind: 'goto', heading: 'GOTOs', items: targetItems(gotoTargets, 'goto') },
  ];
  return sections.filter((s) => s.items.length > 0);
}

/**
 * 1-based physical row of the editor document whose leading BASIC line number
 * equals `lineNo`, or null when absent. BASIC line numbers are not 1:1 with
 * editor rows (blank/unnumbered rows, non-contiguous numbering), so we scan.
 */
export function findRowForLineNumber(
  docText: string,
  lineNo: number,
): number | null {
  const rows = docText.split('\n');
  for (let i = 0; i < rows.length; i++) {
    const m = /^\s*(\d+)\s?/.exec(rows[i]!);
    if (m && parseInt(m[1]!, 10) === lineNo) return i + 1;
  }
  return null;
}
