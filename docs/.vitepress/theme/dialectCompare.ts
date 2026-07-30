// Pure, framework-free diff logic behind the dialect comparison page. Given a
// source and target dialect's reference/escape tables, it buckets the keywords
// and control codes into what a porter loses ("must replace"), gains ("newly
// available") and what changed shape ("behaviour changed"). Node-testable and
// SSG-safe: imports only the docs data types, never `src/`.
import type { KeywordDomain } from '../../reference/data/domains';
import type {
  EscapeEntry,
  EscapeTableData,
  FalseFriend,
  KeywordEquivalence,
  PairPortingNotes,
  PortingFacts,
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

/** One command both dialects provide, spelled differently: `GOTO` → `GO TO`. */
export interface KeywordRename {
  from: ReferenceEntry;
  to: ReferenceEntry;
}

/** One spelling both dialects provide with different meanings. */
export interface FalseFriendWarning {
  keyword: string;
  from: string;
  to: string;
}

/** Which pages are being compared, and the cross-dialect data to apply. */
export interface DiffContext {
  /** Docs page slug of the source table. */
  from: string;
  /** Docs page slug of the target table. */
  to: string;
  equivalences: KeywordEquivalence[];
}

/** The keyword diff between a source and target dialect. */
export interface KeywordDiff {
  /** In the source, absent from the target: rewrite or drop these. */
  mustReplace: ReferenceEntry[];
  /** In the target, absent from the source: newly available capabilities. */
  newlyAvailable: ReferenceEntry[];
  /** Present in both under different spellings: rename these. */
  renamed: KeywordRename[];
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
  context?: DiffContext,
): KeywordDiff {
  const operators = operatorNames(source, target);
  const comparable = (e: ReferenceEntry) => !operators.has(e.name);
  const sourceEntries = source.entries.filter(comparable);
  const targetEntries = target.entries.filter(comparable);
  const sourceByName = new Map(sourceEntries.map((e) => [e.name, e]));
  const targetByName = new Map(targetEntries.map((e) => [e.name, e]));
  const renames = renameMap(context);

  const mustReplace: ReferenceEntry[] = [];
  const renamed: KeywordRename[] = [];
  const behaviourChanged: KeywordChange[] = [];
  /** Target names claimed by a rename, so they aren't also "newly available". */
  const claimed = new Set<string>();
  let unchanged = 0;

  for (const entry of sourceEntries) {
    const renamedTo = renames.get(entry.name);
    const match = targetByName.get(renamedTo ?? entry.name);
    if (!match) {
      mustReplace.push(entry);
    } else if (renamedTo) {
      claimed.add(match.name);
      renamed.push({ from: entry, to: match });
    } else if (keywordChanged(entry, match)) {
      behaviourChanged.push({ name: entry.name, from: entry, to: match });
    } else {
      unchanged += 1;
    }
  }

  const newlyAvailable = targetEntries.filter(
    (e) => !sourceByName.has(e.name) && !claimed.has(e.name),
  );

  return {
    mustReplace: sortEntries(mustReplace, 'name', 'asc'),
    newlyAvailable: sortEntries(newlyAvailable, 'name', 'asc'),
    renamed: [...renamed].sort((a, b) =>
      a.from.name.localeCompare(b.from.name),
    ),
    behaviourChanged: [...behaviourChanged].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    unchanged,
  };
}

/** Entries sharing one capability domain, in the order they were given. */
export interface DomainBucket {
  /**
   * The shared domain, or `undefined` for the trailing bucket that catches
   * anything the supplied order does not name - so a row is never dropped.
   */
  domain: KeywordDomain | undefined;
  entries: ReferenceEntry[];
}

/**
 * Bucket entries by capability. Buckets come back in the order supplied (not
 * alphabetically), domains nothing landed in are omitted, and the input order
 * is preserved within each bucket - so the caller's own sort still shows
 * through. Anything whose domain the order does not name lands in a single
 * trailing `undefined` bucket rather than disappearing.
 *
 * The order is an argument rather than an import, exactly as `composeGuidance`
 * takes its `pairNotes`: this module imports only types from the data layer,
 * which is what keeps it node-testable and SSG-safe.
 */
export function groupByDomain(
  entries: ReferenceEntry[],
  order: readonly KeywordDomain[],
): DomainBucket[] {
  const known = new Set(order);
  const byDomain = new Map<KeywordDomain, ReferenceEntry[]>();
  const rest: ReferenceEntry[] = [];
  for (const entry of entries) {
    if (entry.domain === undefined || !known.has(entry.domain)) {
      rest.push(entry);
      continue;
    }
    const bucket = byDomain.get(entry.domain);
    if (bucket) bucket.push(entry);
    else byDomain.set(entry.domain, [entry]);
  }

  const buckets: DomainBucket[] = [];
  for (const domain of order) {
    const found = byDomain.get(domain);
    if (found) buckets.push({ domain, entries: found });
  }
  if (rest.length) buckets.push({ domain: undefined, entries: rest });
  return buckets;
}

/** One render-ready group of the commands a port must replace. */
export interface DomainSection extends DomainBucket {
  /**
   * True when the target dialect has no keyword in this domain at all - the
   * port loses the capability outright rather than a few of its commands.
   */
  absentFromTarget: boolean;
}

/**
 * Group the commands to replace by capability, reporting the capabilities the
 * target does not provide at all before the ones it does. Ties keep the
 * canonical vocabulary order, since the sort is stable and `groupByDomain`
 * already returns the buckets in the supplied order.
 *
 * "The target has no equivalent of this capability" is read straight off the
 * target's own table - no authored support levels are needed for it.
 */
export function domainSections(
  mustReplace: ReferenceEntry[],
  to: ReferenceTableData,
  order: readonly KeywordDomain[],
): DomainSection[] {
  const provided = new Set(to.entries.map((e) => e.domain));
  return groupByDomain(mustReplace, order)
    .map((bucket) => ({
      ...bucket,
      absentFromTarget:
        bucket.domain !== undefined && !provided.has(bucket.domain),
    }))
    .sort((a, b) => Number(b.absentFromTarget) - Number(a.absentFromTarget));
}

/**
 * Source spelling → target spelling, for commands both pages provide under
 * different names. Groups that don't name both pages, or that spell the command
 * the same on both, contribute nothing.
 */
function renameMap(context?: DiffContext): Map<string, string> {
  const map = new Map<string, string>();
  if (!context) return map;
  for (const { spellings } of context.equivalences) {
    const from = spellings[context.from];
    const to = spellings[context.to];
    if (from && to && from !== to) map.set(from, to);
  }
  return map;
}

/**
 * The commands both pages spell alike and mean differently. Nothing else on the
 * page can surface these: they match on name, kind and often syntax, so they
 * reach none of the diff buckets while still changing what a program computes.
 */
export function falseFriendsBetween(
  from: string,
  to: string,
  entries: FalseFriend[],
): FalseFriendWarning[] {
  const warnings: FalseFriendWarning[] = [];
  for (const { keyword, meanings } of entries) {
    const a = meanings[from];
    const b = meanings[to];
    if (a && b && a !== b) warnings.push({ keyword, from: a, to: b });
  }
  return warnings.sort((x, y) => x.keyword.localeCompare(y.keyword));
}

/** Everything needed to compose the prose guidance for one ordered pair. */
export interface GuidanceContext {
  /** Source page slug. */
  from: string;
  /** Target page slug. */
  to: string;
  /** Facts for the target, whose portingNotes and substitutions are surfaced. */
  targetFacts?: PortingFacts;
  /** The full sparse pair-note table; the matching (from,to) entry is selected. */
  pairNotes: PairPortingNotes[];
  /** The full false-friend table; the pair's warnings are selected. */
  falseFriends: FalseFriend[];
}

/**
 * The prose guidance for one chosen pair, gathered in one place: what to watch
 * for on the target machine, notes specific to this direction, the same-name-
 * different-meaning warnings, and the per-command "do this instead" advice.
 *
 * The hardware address facts (screen base, program start) are deliberately not
 * here: they interpolate both sides and render as rows of the fact table, not
 * as prose.
 */
export interface PairGuidance {
  /** Target-anchored bullets (PortingFacts.portingNotes); may be empty. */
  targetNotes: string[];
  /** Notes for exactly this ordered pair; empty when the pair has none. */
  pairNotes: string[];
  /** Same-name-different-meaning warnings for this pair. */
  falseFriends: FalseFriendWarning[];
  /** keyword → "do this instead", for inline display against the diff lists. */
  substitutions: Map<string, string>;
}

/**
 * Assemble the per-pair prose guidance. Pure and SSG-safe like the diff
 * functions: every input is passed in, nothing is imported from the data
 * modules or from `src/`.
 */
export function composeGuidance(ctx: GuidanceContext): PairGuidance {
  const pair = ctx.pairNotes.find(
    (n) => n.from === ctx.from && n.to === ctx.to,
  );
  return {
    targetNotes: ctx.targetFacts?.portingNotes ?? [],
    pairNotes: pair?.notes ?? [],
    falseFriends: falseFriendsBetween(ctx.from, ctx.to, ctx.falseFriends),
    substitutions: new Map(
      (ctx.targetFacts?.substitutions ?? []).map((s) => [s.keyword, s.note]),
    ),
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
