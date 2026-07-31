// Pure, framework-free diff logic behind the dialect comparison page. Given a
// source and target dialect's reference/escape tables, it buckets the keywords
// and control codes into what a porter loses ("must replace"), gains ("newly
// available") and what changed shape ("behaviour changed"). Node-testable and
// SSG-safe: imports only the docs data types, never `src/`.
import type { KeywordDomain } from '../../reference/data/domains';
import type { DomainGuidance } from '../../reference/data/domain-guidance';
import type {
  EscapeEntry,
  EscapeTableData,
  FalseFriend,
  KeywordEquivalence,
  PairPortingNotes,
  PortingFacts,
  ReferenceEntry,
  ReferenceTableData,
  TargetPortingNote,
} from '../../reference/data/types';
import { sortEntries } from './referenceTable';

/** Support tiers in the order a port should read them: worst-placed first. */
const SUPPORT_RANK: Record<DomainGuidance['support'], number> = {
  none: 0,
  partial: 1,
  full: 2,
};

/**
 * What changed about a keyword the two dialects both provide. Derived here
 * rather than in the template so the classification is testable, and so the
 * reader is told what changed instead of being handed two usage strings to
 * compare by eye.
 */
export type KeywordChangeKind = 'kind' | 'parens' | 'arguments';

/** One keyword that exists in both dialects but changed kind or syntax. */
export interface KeywordChange {
  name: string;
  from: ReferenceEntry;
  to: ReferenceEntry;
  /** Which of the three ways this keyword differs; see {@link KeywordChangeKind}. */
  change: KeywordChangeKind;
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

/**
 * Rows one machine actually has. A row with no `onlyOn` belongs to every machine
 * its page covers; one that names ids belongs only to those.
 */
function entriesForMachine<E extends { onlyOn?: string[] }>(
  entries: readonly E[],
  dialectId: string,
): E[] {
  return entries.filter((e) => !e.onlyOn || e.onlyOn.includes(dialectId));
}

/**
 * Narrow a reference table to one machine, so the diff compares machines rather
 * than pages.
 *
 * Four of the eight reference pages cover more than one machine - the Spectrum's
 * 48K and 128K, the BBC's BASIC II and IV, Locomotive 1.0 and 1.1, and the
 * Commodore V2 and 4.0 - and the rows a page carries are the *union* of what its
 * machines have. Diffing the unions reports commands the reader's machine does
 * not have (a C64 port asked to deal with the PET-only `DLOAD`) and offers
 * commands the target does not have (`FILL` on a CPC 464).
 *
 * Applied by the caller rather than inside {@link diffKeywords} and friends:
 * those take whole tables already, so one filter here spares four signatures a
 * machine parameter and keeps this module what its header promises - pure, and
 * knowing nothing about `src/`.
 */
export function tableForMachine(
  table: ReferenceTableData,
  dialectId: string,
): ReferenceTableData {
  return { ...table, entries: entriesForMachine(table.entries, dialectId) };
}

/**
 * Narrow an escape table to one machine. See {@link tableForMachine}; the rule
 * is identical, only rarer - a control code is a property of the charset, and
 * machines sharing a page usually share the charset outright.
 */
export function escapeTableForMachine(
  table: EscapeTableData,
  dialectId: string,
): EscapeTableData {
  return { ...table, entries: entriesForMachine(table.entries, dialectId) };
}

/** Collapse runs of internal whitespace so cosmetic spacing isn't a "change". */
function normaliseSyntax(syntax: string): string {
  return syntax.trim().replace(/\s+/g, ' ');
}

/**
 * The *shape* of a usage string: what it accepts, with the names of its
 * placeholders thrown away. `<…>` groups and lowercase identifiers collapse to
 * one `#` marker, and spacing around separators and inside brackets is
 * normalised, so `<number>, <number>` and `x,y` come out alike. Every marker is
 * kept, so a third argument is still a difference; brackets, punctuation and
 * literal (uppercase) keywords survive too.
 *
 * This exists because the eight reference pages were authored independently and
 * do not share a placeholder convention - the Amstrad page writes `ABS(n)`
 * where the other seven write `ABS(<number>)`. Comparing the text reports 72
 * "behaviour changes" between the BBC and the Amstrad, nearly all of them
 * editorial; comparing the shape reports the ones a port has to act on.
 *
 * Kept deliberately coarse-but-structural: `SIN <number>` and `SIN(n)` still
 * differ (the Sinclair machines take the argument unparenthesised) and
 * `LIST [<line>][-[<line>]]` still differs from `LIST [<line>]`.
 */
function syntaxShape(syntax: string): string {
  return normaliseSyntax(syntax)
    .replace(/<[^>]*>/g, '#')
    .replace(/[A-Za-z_][A-Za-z0-9_$#]*\$?/g, (word) =>
      /^[A-Z][A-Z0-9$#]*$/.test(word) ? word : '#',
    )
    .replace(/\s*([,;|])\s*/g, '$1')
    .replace(/([([])\s+/g, '$1')
    .replace(/\s+([)\]])/g, '$1')
    .trim();
}

/** True when two shapes differ only in whether the arguments are bracketed. */
function parenthesesOnly(a: string, b: string): boolean {
  const bare = (shape: string) => shape.replace(/[()\s]/g, '');
  return bare(a) === bare(b);
}

/**
 * How a keyword both dialects provide differs, or `undefined` when it does not.
 * `description` is deliberately excluded: prose wording differs between pages
 * without implying a real porting difference, so it would only add noise. So is
 * placeholder naming, for the same reason - see {@link syntaxShape}.
 */
function keywordChange(
  a: ReferenceEntry,
  b: ReferenceEntry,
): KeywordChangeKind | undefined {
  if (a.kind !== b.kind) return 'kind';
  const from = syntaxShape(a.syntax);
  const to = syntaxShape(b.syntax);
  if (from === to) return undefined;
  return parenthesesOnly(from, to) ? 'parens' : 'arguments';
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
      continue;
    }
    if (renamedTo) {
      claimed.add(match.name);
      renamed.push({ from: entry, to: match });
      continue;
    }
    const change = keywordChange(entry, match);
    if (change) {
      behaviourChanged.push({
        name: entry.name,
        from: entry,
        to: match,
        change,
      });
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

/** What the target adds in one capability, summarised rather than listed. */
export interface CapabilityGain {
  /** How many target-only commands land in this capability. */
  count: number;
  /** "What this machine offers here" — DomainGuidance.summary for the cell. */
  summary: string;
  /** Up to a few of the target's command names to reach for. */
  reachFor: string[];
}

/** One render-ready account of what a port does to a single capability. */
export interface CapabilitySection extends DomainBucket {
  /**
   * The commands the port loses here. Empty for a capability the target only
   * adds to - `entries` is the same array, kept for {@link DomainBucket}.
   */
  entries: ReferenceEntry[];
  /**
   * True when the target dialect has no keyword in this domain at all - the
   * port loses the capability outright rather than a few of its commands.
   */
  absentFromTarget: boolean;
  /**
   * How well the target replaces this capability: authored `DomainGuidance`
   * support where given, falling back to `absentFromTarget` (`'none'` vs
   * `'full'`) when no guidance table is supplied - the same signal the
   * previous placeholder ordering used.
   */
  support: DomainGuidance['support'];
  /**
   * What the target adds here, where it adds anything and the guidance table
   * has a cell to describe it. Absent when the port gains nothing in this
   * capability.
   */
  gained?: CapabilityGain;
}

/** How many command names a capability's gain line names, at most. */
const GAIN_NAMES = 4;

/**
 * One account per capability: what the port loses here, and what the target
 * adds here, together.
 *
 * They were two sections until the reader's own question turned out to span
 * both - "what happens to my graphics code" was answered once under the
 * commands to replace and again under the commands newly available, from the
 * two halves (`instead` and `summary`) of the same `DomainGuidance` cell. Over
 * half of all capability mentions were made twice.
 *
 * Capabilities the port loses commands from lead, worst-placed first: those the
 * target has no equivalent of at all, then those it supports only partially,
 * then those it has fully under other names. Ties keep the canonical vocabulary
 * order, since the sort is stable and `groupByDomain` already returns the
 * buckets in the supplied order. Capabilities the port only *gains* follow,
 * largest gain first - news rather than work.
 *
 * `reachFor` prefers the authored names, filtered to ones the source actually
 * lacks, so a command the reader already has is never offered as new.
 *
 * `domainGuidance` and `toSlug` are optional and taken as arguments, exactly
 * as `composeGuidance` takes its `pairNotes` - this module imports only types
 * from the data layer. Omitting them falls back to the target's own table
 * ("has no keyword in this domain at all" vs "has one") and reports no gains,
 * since a gain has nothing to say without its authored summary.
 */
export function capabilitySections(
  mustReplace: ReferenceEntry[],
  newlyAvailable: ReferenceEntry[],
  to: ReferenceTableData,
  order: readonly KeywordDomain[],
  domainGuidance?: DomainGuidance[],
  toSlug?: string,
): CapabilitySection[] {
  const provided = new Set(to.entries.map((e) => e.domain));
  const guidanceByDomain = toSlug
    ? new Map(
        (domainGuidance ?? [])
          .filter((g) => g.to === toSlug)
          .map((g) => [g.domain, g]),
      )
    : undefined;

  const supportOf = (
    domain: KeywordDomain | undefined,
  ): DomainGuidance['support'] => {
    if (domain === undefined) return 'full';
    const cell = guidanceByDomain?.get(domain);
    if (cell) return cell.support;
    return provided.has(domain) ? 'full' : 'none';
  };

  /** domain → what the target adds there, for the domains it adds to. */
  const gains = new Map<KeywordDomain, CapabilityGain>();
  for (const bucket of groupByDomain(newlyAvailable, order)) {
    if (!bucket.domain) continue;
    const cell = guidanceByDomain?.get(bucket.domain);
    if (!cell) continue;
    const names = bucket.entries.map((e) => e.name);
    const nameSet = new Set(names);
    const reachFor = (cell.reachFor ?? []).filter((n) => nameSet.has(n));
    gains.set(bucket.domain, {
      count: bucket.entries.length,
      summary: cell.summary,
      reachFor: (reachFor.length ? reachFor : names).slice(0, GAIN_NAMES),
    });
  }

  const losing = groupByDomain(mustReplace, order)
    .map((bucket) => ({
      ...bucket,
      absentFromTarget:
        bucket.domain !== undefined && !provided.has(bucket.domain),
      support: supportOf(bucket.domain),
      gained: bucket.domain ? gains.get(bucket.domain) : undefined,
    }))
    .sort((a, b) => SUPPORT_RANK[a.support] - SUPPORT_RANK[b.support]);

  const lost = new Set(losing.map((s) => s.domain));
  const gaining: CapabilitySection[] = [];
  for (const domain of order) {
    if (lost.has(domain)) continue;
    const gained = gains.get(domain);
    if (!gained) continue;
    gaining.push({
      domain,
      entries: [],
      absentFromTarget: false,
      support: supportOf(domain),
      gained,
    });
  }
  gaining.sort((a, b) => (b.gained?.count ?? 0) - (a.gained?.count ?? 0));

  return [...losing, ...gaining];
}

/** One render-ready group of control codes: a category's worth of them. */
export interface EscapeSection {
  /** Category id from the owning table, or `undefined` for the trailing bucket. */
  category: string | undefined;
  /** Human label from the owning table's `categories`; the id if it names none. */
  label: string;
  entries: EscapeEntry[];
}

/**
 * Group control codes by what they do, in the order the owning table declares
 * its categories - which is already editorial (the Commodore page leads with
 * colour and cursor and ends with the raw-byte escape), so the reader meets the
 * codes a screen layout depends on rather than an alphabetical run of keycap
 * block graphics. Categories nothing landed in are omitted; a code whose
 * category the table does not declare lands in a trailing bucket rather than
 * disappearing.
 *
 * Unlike {@link capabilitySections} this does *not* rank a category by whether the
 * other dialect covers it. `KeywordDomain` is one closed vocabulary shared by
 * every page, but escape categories are page-scoped: `colour` and `cursor` are
 * Commodore categories, while the Spectrum files its `{INK n}` under `control`.
 * Matching ids across the two would announce "nothing like it on the target"
 * for codes the target plainly has.
 *
 * `table` is the table the entries came from - the source table for the codes a
 * port must replace, the target's for the ones it gains.
 */
export function escapeSections(
  entries: EscapeEntry[],
  table: EscapeTableData,
): EscapeSection[] {
  const labels = new Map(table.categories.map((c) => [c.id, c.label]));
  const byCategory = new Map<string, EscapeEntry[]>();
  const rest: EscapeEntry[] = [];
  for (const entry of entries) {
    if (!labels.has(entry.category)) {
      rest.push(entry);
      continue;
    }
    const bucket = byCategory.get(entry.category);
    if (bucket) bucket.push(entry);
    else byCategory.set(entry.category, [entry]);
  }

  const sections: EscapeSection[] = [];
  for (const { id, label } of table.categories) {
    const found = byCategory.get(id);
    if (found) sections.push({ category: id, label, entries: found });
  }
  if (rest.length)
    sections.push({ category: undefined, label: 'Other', entries: rest });
  return sections;
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
  /** The full domain-guidance table; cells for `to` are exposed via `domains`. */
  domainGuidance?: DomainGuidance[];
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
  /**
   * Target-anchored bullets (PortingFacts.portingNotes), less the ones the
   * pair notes have already made - the two are shown as one list, so a point
   * made in both would be read twice. May be empty.
   */
  targetNotes: string[];
  /** Notes for exactly this ordered pair; empty when the pair has none. */
  pairNotes: string[];
  /** Same-name-different-meaning warnings for this pair. */
  falseFriends: FalseFriendWarning[];
  /** keyword → "do this instead", for inline display against the diff lists. */
  substitutions: Map<string, string>;
  /**
   * The target's domain-guidance cells, keyed by domain. Target-scoped (every
   * cell has `to === ctx.to`) and empty when `domainGuidance` is omitted.
   */
  domains: Map<KeywordDomain, DomainGuidance>;
}

/**
 * Assemble the per-pair prose guidance. Pure and SSG-safe like the diff
 * functions: every input is passed in, nothing is imported from the data
 * modules or from `src/`.
 *
 * The pair notes lead the section and the target notes follow it, so a target
 * note whose every point the pair notes have already made is dropped rather
 * than read a second time in more general terms - what each note covers is
 * authored, not inferred from the prose.
 */
export function composeGuidance(ctx: GuidanceContext): PairGuidance {
  const pair = ctx.pairNotes.find(
    (n) => n.from === ctx.from && n.to === ctx.to,
  );
  const notes = pair?.notes ?? [];
  const covered = new Set(notes.flatMap((n) => n.covers ?? []));
  /**
   * Superseded when the pair notes above it have already made its every point.
   * A note carrying several points survives until all of them are covered, and
   * one carrying none (which the crosscheck forbids) is never dropped.
   */
  const superseded = (note: TargetPortingNote) =>
    note.topics.length > 0 && note.topics.every((topic) => covered.has(topic));
  return {
    targetNotes: (ctx.targetFacts?.portingNotes ?? [])
      .filter((n) => !superseded(n))
      .map((n) => n.text),
    pairNotes: notes.map((n) => n.text),
    falseFriends: falseFriendsBetween(ctx.from, ctx.to, ctx.falseFriends),
    substitutions: new Map(
      (ctx.targetFacts?.substitutions ?? []).map((s) => [s.keyword, s.note]),
    ),
    domains: new Map(
      (ctx.domainGuidance ?? [])
        .filter((g) => g.to === ctx.to)
        .map((g) => [g.domain, g]),
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
