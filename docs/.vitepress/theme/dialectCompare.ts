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
 * Diff two keyword tables by unique `name`. Buckets are returned in the
 * canonical name order the reference tables already use (via `sortEntries`);
 * comparing a dialect with itself yields empty buckets.
 */
export function diffKeywords(
  source: ReferenceTableData,
  target: ReferenceTableData,
): KeywordDiff {
  const sourceByName = new Map(source.entries.map((e) => [e.name, e]));
  const targetByName = new Map(target.entries.map((e) => [e.name, e]));

  const mustReplace: ReferenceEntry[] = [];
  const behaviourChanged: KeywordChange[] = [];
  let unchanged = 0;

  for (const entry of source.entries) {
    const match = targetByName.get(entry.name);
    if (!match) {
      mustReplace.push(entry);
    } else if (keywordChanged(entry, match)) {
      behaviourChanged.push({ name: entry.name, from: entry, to: match });
    } else {
      unchanged += 1;
    }
  }

  const newlyAvailable = target.entries.filter(
    (e) => !sourceByName.has(e.name),
  );

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
