// Pure, framework-free diff logic behind the dialect comparison page. Given a
// source and target dialect's reference/escape tables, it buckets the keywords
// and control codes into what a porter loses ("must replace"), gains ("newly
// available") and what changed shape ("behaviour changed"). Node-testable and
// SSG-safe: imports only the docs data types, never `src/`.
import type {
  EscapeEntry,
  EscapeTableData,
  ReferenceEntry,
  ReferenceTableData,
} from '../../reference/data/types';
import { sortEntries } from './referenceTable';

/** One keyword that exists in both dialects but changed kind or syntax. */
export interface KeywordChange {
  name: string;
  from: ReferenceEntry;
  to: ReferenceEntry;
}

/** The keyword diff between a source and target dialect. */
export interface KeywordDiff {
  /** In the source, absent from the target: rewrite or drop these. */
  mustReplace: ReferenceEntry[];
  /** In the target, absent from the source: newly available capabilities. */
  newlyAvailable: ReferenceEntry[];
  /** Present in both but with a different kind or (normalised) syntax. */
  behaviourChanged: KeywordChange[];
  /** Count of keywords present and identical in both (for the summary line). */
  unchanged: number;
}

/** One control code that exists in both dialects but changed bytes/category. */
export interface EscapeChange {
  escape: string;
  from: EscapeEntry;
  to: EscapeEntry;
}

/** The escape-code diff between a source and target dialect. */
export interface EscapeDiff {
  mustReplace: EscapeEntry[];
  newlyAvailable: EscapeEntry[];
  behaviourChanged: EscapeChange[];
  unchanged: number;
}

/** Collapse runs of internal whitespace so cosmetic spacing isn't a "change". */
function normaliseSyntax(syntax: string): string {
  return syntax.trim().replace(/\s+/g, ' ');
}

/**
 * A keyword "changed behaviour" when the same name has a different kind, or a
 * different syntax once whitespace is normalised. `description` is deliberately
 * excluded: prose wording differs between pages without implying a real porting
 * difference, so it would only add noise.
 */
function keywordChanged(a: ReferenceEntry, b: ReferenceEntry): boolean {
  return (
    a.kind !== b.kind || normaliseSyntax(a.syntax) !== normaliseSyntax(b.syntax)
  );
}

/** An escape code "changed" when the same spelling maps to different bytes or category. */
function escapeChanged(a: EscapeEntry, b: EscapeEntry): boolean {
  return a.bytes !== b.bytes || a.category !== b.category;
}

/**
 * Names to drop from the keyword diff: everything either page calls an
 * operator. The reference tables have no common rule for which operators earn a
 * row - `+ - * /` are tabulated on four of the eight BASIC pages and `( ) , ;`
 * on one - so diffing them compares editorial choices rather than languages,
 * and reports that a dialect "lacks" `+`. Operator differences that matter to a
 * port are carried by `PortingFacts` instead (as `exponentOperator` already is)
 * and shown in the facts table.
 *
 * The union matters: the pages also disagree about *kind*, so `NOT` is an
 * operator row on the BBC and a function row on the ZX81. Filtering each page
 * on its own would drop the BBC's row, keep the ZX81's, and report `NOT` as
 * newly available on a machine that has had it all along.
 */
function operatorNames(...tables: ReferenceTableData[]): Set<string> {
  const names = new Set<string>();
  for (const table of tables) {
    for (const entry of table.entries) {
      if (entry.kind === 'operator') names.add(entry.name);
    }
  }
  return names;
}

/**
 * Diff two keyword tables by unique `name`. Buckets are returned in the
 * canonical name order the reference tables already use (via `sortEntries`);
 * comparing a dialect with itself yields empty buckets.
 */
export function diffKeywords(
  source: ReferenceTableData,
  target: ReferenceTableData,
): KeywordDiff {
  const operators = operatorNames(source, target);
  const comparable = (e: ReferenceEntry) => !operators.has(e.name);
  const sourceEntries = source.entries.filter(comparable);
  const targetEntries = target.entries.filter(comparable);
  const sourceByName = new Map(sourceEntries.map((e) => [e.name, e]));
  const targetByName = new Map(targetEntries.map((e) => [e.name, e]));

  const mustReplace: ReferenceEntry[] = [];
  const behaviourChanged: KeywordChange[] = [];
  let unchanged = 0;

  for (const entry of sourceEntries) {
    const match = targetByName.get(entry.name);
    if (!match) {
      mustReplace.push(entry);
    } else if (keywordChanged(entry, match)) {
      behaviourChanged.push({ name: entry.name, from: entry, to: match });
    } else {
      unchanged += 1;
    }
  }

  const newlyAvailable = targetEntries.filter((e) => !sourceByName.has(e.name));

  return {
    mustReplace: sortEntries(mustReplace, 'name', 'asc'),
    newlyAvailable: sortEntries(newlyAvailable, 'name', 'asc'),
    behaviourChanged: [...behaviourChanged].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    unchanged,
  };
}

/**
 * Diff two escape-code tables by unique `escape` spelling. Same bucket shape as
 * {@link diffKeywords}. Only meaningful when both dialects have escape data; the
 * caller decides whether to render it.
 */
export function diffEscapes(
  source: EscapeTableData,
  target: EscapeTableData,
): EscapeDiff {
  const sourceByName = new Map(source.entries.map((e) => [e.escape, e]));
  const targetByName = new Map(target.entries.map((e) => [e.escape, e]));

  const mustReplace: EscapeEntry[] = [];
  const behaviourChanged: EscapeChange[] = [];
  let unchanged = 0;

  for (const entry of source.entries) {
    const match = targetByName.get(entry.escape);
    if (!match) {
      mustReplace.push(entry);
    } else if (escapeChanged(entry, match)) {
      behaviourChanged.push({ escape: entry.escape, from: entry, to: match });
    } else {
      unchanged += 1;
    }
  }

  const newlyAvailable = target.entries.filter(
    (e) => !sourceByName.has(e.escape),
  );

  const byEscape = (a: { escape: string }, b: { escape: string }) =>
    a.escape.localeCompare(b.escape);

  return {
    mustReplace: [...mustReplace].sort(byEscape),
    newlyAvailable: [...newlyAvailable].sort(byEscape),
    behaviourChanged: [...behaviourChanged].sort(byEscape),
    unchanged,
  };
}
