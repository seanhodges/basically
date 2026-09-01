// Pure, framework-free diff logic behind the dialect comparison page. Given a
// source and target dialect's reference/escape tables, it buckets the keywords
// and control codes into what a porter loses ("must replace"), gains ("newly
// available") and what changed shape ("behaviour changed").
//
// Node-testable and SSG-safe, and it stays that way by importing only its
// sibling reference data - never the dialect registry or anything reaching an
// emulator core. That is what lets the documentation site's static build and the
// IDE both use it; see the folder's note in docs/contributing/architecture.md.
import type { KeywordDomain } from './domains';
import type { DomainGuidance } from './domain-guidance';
import type { EscapeClass } from './escape-classes';
import type { EscapeGuidance } from './escape-guidance';
// Type-only, and the distinction is the whole of the purity rule above: an
// `import type` erases at build time and reaches no runtime module, so naming
// these costs the documentation bundle nothing. A memory map is plain data and
// both maps arrive as arguments; the comparison page already imports the same
// type for its own props. A *value* import from `src/dialects/` would be
// another matter - that folder's index modules reach the emulator cores.
import type { MemoryMap, MemoryRegion } from '../dialects/types';
import type {
  ConditionalFreeMemory,
  EscapeEntry,
  EscapeTableData,
  FalseFriend,
  KeywordEquivalence,
  PairPortingNotes,
  PortingFacts,
  ReferenceEntry,
  ReferenceTableData,
  TargetPortingNote,
  TextScreen,
  VariableSignificance,
} from './types';
import { writesByIndirection } from './types';
import { foldNameCase } from '../dialects/letterCase';
import { ramBudget, ramSeverity, type RamSeverity } from './ramBudget';
import { sortEntries } from './sort';

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
  /** Machine id of the source, which is what the spellings are keyed by. */
  from: string;
  /** Machine id of the target. */
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
 * Whether a value naming one machine or several names this one. The shape the
 * pair notes and the domain-guidance cells both use for their target.
 */
export function namesMachine(
  side: string | readonly string[],
  dialectId: string,
): boolean {
  return typeof side === 'string'
    ? side === dialectId
    : side.includes(dialectId);
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
export function tableForMachine<T extends ReferenceTableData>(
  table: T,
  dialectId: string,
): T {
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
 * placeholders thrown away. Every `<…>` group collapses to one `#` marker, and
 * spacing around separators and inside brackets is normalised, so
 * `<number>, <number>` and `<x>,<y>` come out alike. Every marker is kept, so a
 * third argument is still a difference; brackets, punctuation and literal
 * keywords survive too.
 *
 * Discarding the name is the point, and it stays necessary even now that all the
 * pages share one vocabulary (src/reference/placeholders.ts). Two things it
 * absorbs:
 *
 * - Each page names a slot in its own machine's words where the machines'
 *   documentation differs - the Acorn machines' `SOUND` takes an `<amplitude>`
 *   and the Amstrad's a `<volume>`.
 * - One page can be more specific than another about the same argument, so
 *   `POKE <addr>, <byte>` meets `POKE <number>, <number>`.
 *
 * Neither is a difference a port has to act on. Note that a *bare* placeholder
 * would now survive as itself and read as a literal keyword, so it would show up
 * as a difference: `reference-data.test.ts` is what rules that out, rather than a
 * rule here quietly absorbing it.
 *
 * Kept deliberately coarse-but-structural: `SIN <number>` and `SIN(<number>)`
 * still differ (the Sinclair machines take the argument unparenthesised) and
 * `LIST [<line>][-[<line>]]` still differs from `LIST [<line>]`.
 *
 * One residue it does not fold: `DEF FN<name>` and `DEF FN <name>` differ across
 * pages, and `normaliseSyntax` keeps that space, so machines that genuinely
 * differ there keep reporting `DEF` as an argument change. Folding keyword
 * spellings is a bigger job than {@link parenthesesOnly} and not this one.
 */
function syntaxShape(syntax: string): string {
  return normaliseSyntax(syntax)
    .replace(/<[^>]*>/g, '#')
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
 * Operators every one of these machines has, so a diff that reported them would
 * only ever report them as unchanged.
 *
 * The tables list them now - each page carries a row for every operator its
 * machine has, pinned by keyword-crosscheck.test.ts - which is what lets the
 * rest of the operators into the diff at last. `+` on both sides is not a
 * finding; a `**` that has to become `↑`, or a `MOD` the target has no
 * equivalent of, is exactly the finding a porter needed and never got.
 */
const UNIVERSAL_OPERATORS: ReadonlySet<string> = new Set([
  '+',
  '-',
  '*',
  '/',
  '=',
  '<',
  '>',
]);

/**
 * Names to drop from the keyword diff.
 *
 * Two kinds, and neither is "operators" any more. The universal arithmetic and
 * relational operators above, which every machine here has and which would fill
 * the diff with unchanged rows. And any name one page calls an operator and the
 * other calls something else: `NOT` is an operator row on the BBC and a function
 * row on the ZX81, `THEN` and `TO` an operator row on the Sinclair and Commodore
 * pages and a command row on the Acorn and Amstrad ones. Both machines have the
 * word; what differs is which side of a classification the page put it on, and
 * reporting that as a behaviour change is reporting an editorial decision.
 *
 * A command that became a function - a real change in how a program calls it -
 * still reports, because neither kind is `operator`.
 *
 * This used to drop every operator on either page, because the tables had no
 * common rule for which operators earned a row and diffing them compared
 * editorial choices rather than languages. They have one now.
 */
function incomparableNames(
  source: ReferenceTableData,
  target: ReferenceTableData,
): Set<string> {
  const names = new Set<string>(UNIVERSAL_OPERATORS);
  const targetKinds = new Map(target.entries.map((e) => [e.name, e.kind]));
  for (const entry of source.entries) {
    const other = targetKinds.get(entry.name);
    if (other === undefined || other === entry.kind) continue;
    if (entry.kind === 'operator' || other === 'operator')
      names.add(entry.name);
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
  const incomparable = incomparableNames(source, target);
  const comparable = (e: ReferenceEntry) => !incomparable.has(e.name);
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
 * `domainGuidance` and `toMachine` are optional and taken as arguments, exactly
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
  toMachine?: string,
): CapabilitySection[] {
  const provided = new Set(to.entries.map((e) => e.domain));
  const guidanceByDomain = toMachine
    ? new Map(
        (domainGuidance ?? [])
          .filter((g) => namesMachine(g.to, toMachine))
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
  /**
   * What class of code the group holds - the cross-page handle the guidance is
   * keyed by. `undefined` for the trailing bucket, whose codes name a category
   * the table never declared, so nothing says what they are.
   */
  class: EscapeClass | undefined;
  /**
   * What the target can do about this class, where a guidance table was
   * supplied and has a cell for it. Absent otherwise - the caller renders the
   * group without a verdict rather than inventing one.
   */
  guidance?: EscapeGuidance;
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
 * The category *ids* still never cross pages, and cannot: `colour` and `cursor`
 * are Commodore categories, while the Spectrum files its `{INK n}` under
 * `control`. Matching ids across the two would announce "nothing like it on the
 * target" for codes the target plainly has.
 *
 * What each group *is* does cross pages, though, and that is what the class on
 * every category carries: `key-graphics` on the Commodore and `graphics` on the
 * Atom are both `block-graphics`, so the guidance for "what does this machine do
 * about block graphics" can be authored once per target. That class is what lets
 * these be ranked the way {@link capabilitySections} ranks the capabilities, and
 * they are: worst-placed first, so the classes the target cannot express at all
 * lead, then the ones it half expresses, then the ones it has under its own
 * spellings. 63 key-graphics codes to redraw by hand and 5 cursor codes that
 * become a print-at are not equal work, and the badge alone left the reader to
 * find that out by scanning.
 *
 * Ties keep the source page's own category order, since the sort is stable and
 * the sections are built in that order - so the editorial order still shows
 * through wherever the ranking has nothing to say, including when no guidance
 * table is supplied at all. A group whose class the target has no cell for ranks
 * with the mildest: nothing is known against it, and a missing cell is not a
 * verdict.
 *
 * `table` is the table the entries came from - the source table for the codes a
 * port must replace, the target's for the ones it gains.
 *
 * `escapeGuidance` and `toMachine` are optional and taken as arguments, exactly
 * as {@link capabilitySections} takes its `domainGuidance` - this module imports
 * only types from the data layer. Omitting them yields sections with no verdict.
 */
export function escapeSections(
  entries: EscapeEntry[],
  table: EscapeTableData,
  escapeGuidance?: EscapeGuidance[],
  toMachine?: string,
): EscapeSection[] {
  const categories = new Map(table.categories.map((c) => [c.id, c]));
  const byCategory = new Map<string, EscapeEntry[]>();
  const rest: EscapeEntry[] = [];
  for (const entry of entries) {
    if (!categories.has(entry.category)) {
      rest.push(entry);
      continue;
    }
    const bucket = byCategory.get(entry.category);
    if (bucket) bucket.push(entry);
    else byCategory.set(entry.category, [entry]);
  }

  const guidanceByClass = toMachine
    ? new Map(
        (escapeGuidance ?? [])
          .filter((g) => namesMachine(g.to, toMachine))
          .map((g) => [g.class, g]),
      )
    : undefined;

  const sections: EscapeSection[] = [];
  for (const { id, label, class: cls } of table.categories) {
    const found = byCategory.get(id);
    if (found)
      sections.push({
        category: id,
        label,
        entries: found,
        class: cls,
        guidance: guidanceByClass?.get(cls),
      });
  }
  if (rest.length)
    sections.push({
      category: undefined,
      label: 'Other',
      entries: rest,
      class: undefined,
    });
  // Worst-placed first, exactly as the capability sections are ranked, and by
  // the same table. Stable, so a rank the guidance cannot decide leaves the
  // source page's category order untouched.
  return sections.sort(
    (a, b) =>
      SUPPORT_RANK[a.guidance?.support ?? 'full'] -
      SUPPORT_RANK[b.guidance?.support ?? 'full'],
  );
}

/**
 * Source spelling → target spelling, for commands both machines provide under
 * different names. Groups that don't name both machines, or that spell the
 * command the same on both, contribute nothing.
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
 * The commands both machines spell alike and mean differently. Nothing else on
 * the page can surface these: they match on name, kind and often syntax, so they
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
  /** Machine id being ported from. */
  from: string;
  /** Machine id being ported to. */
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
   * The target machine's domain-guidance cells, keyed by domain. Target-scoped
   * (every cell names `ctx.to`) and empty when `domainGuidance` is omitted.
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
    (n) => namesMachine(n.from, ctx.from) && namesMachine(n.to, ctx.to),
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
        .filter((g) => namesMachine(g.to, ctx.to))
        .map((g) => [g.domain, g]),
    ),
  };
}

/**
 * What the open program uses, as the IDE reports it across the iframe boundary
 * (`PROGRAM_VOCABULARY_FIELDS` in `src/components/DocsDrawer.tsx`). Declared
 * here rather than imported: this module never reaches into `src/`, and the two
 * sides agree by field name, pinned by `DocsDrawer.test.ts`.
 *
 * Keywords cross as names because the names are already identical on both sides
 * and cross-checked per machine. Control codes cross as *bytes*, because a
 * spelling match would have to reconcile aliases (`{wht}` against the canonical
 * `{white}`), operand-carrying forms (a program's `{INK 2}` against the table's
 * `{INK n}`) and raw-byte escapes - none of which a byte value has.
 */
export interface ProgramVocabulary {
  /** The machine the program was read as; only meaningful against that one. */
  dialectId: string;
  keywords: string[];
  /**
   * The short spellings the program's code contains, each with the command the
   * source machine reads it as (`?`/`PRINT`, `P.`/`PRINT`). Their keywords are
   * in {@link keywords} as well, so the narrowing treats a command reached
   * through an abbreviation exactly as one spelled out. See the app-side twin.
   */
  spellings: ProgramSpelling[];
  /**
   * Distinct variable names the program's code contains, upper-cased, in the
   * source machine's own spelling. Grouped by the *target's* significance rule
   * to find the names it would treat as one. See the app-side twin.
   */
  variables: string[];
  /** Whether the program's code divides, and whether it carries a fraction. */
  divides: boolean;
  fractionalLiteral: boolean;
  /**
   * Distinct whole-number values in the program's code large enough that some
   * integer-only machine here cannot hold them, ascending. Checked against the
   * target's own range to name the values that do not arrive. See the app-side
   * twin, which owns the floor they are collected from.
   */
  largeNumbers: number[];
  escapeCodes: number[];
  /** Printable ASCII the program's text contains. See the app-side twin. */
  characters: string[];
  /** BASIC line numbers carrying more than one statement. */
  multiStatementLines: number[];
  /** How many statements the program carries beyond one per line, in total. */
  extraStatements: number;
  /** The span of BASIC line numbers the program's text carries, or null. */
  lineNumbers: { lowest: number; highest: number; count: number } | null;
  /**
   * The addresses the program writes to, resolved for the machine it was read
   * as. Marked on both machines' memory layouts: on the source's because that
   * is where the program aimed them, and on the target's because that is where
   * they would land.
   */
  writeSites: ProgramWriteSite[];
  /**
   * The addresses the program reads back, resolved for the machine it was read
   * as. Marked and judged on both machines exactly as the writes are: a read
   * aimed at one machine's frame clock reaches another machine's program text
   * and returns numbers that mean nothing.
   */
  readSites: ProgramReadSite[];
  /**
   * The addresses the program hands to the processor - its `SYS`, `CALL`,
   * `LINK` and address-taking `USR` targets. Not landings but routines: what
   * lives there is the source machine's processor code.
   */
  callSites: ProgramReadSite[];
  /** The code and data blocks the document carries beside the program. */
  codeBlocks: ProgramCodeBlock[];
  /**
   * The screen modes the program selects, or null on a machine with no command
   * for selecting one. What decides whether a target's conditionally free
   * memory is actually free. The app-side twin is `ScreenModeUse`.
   */
  screenModes: ScreenModeUse | null;
  /**
   * Where on the text screen the program says to print, or null on a machine
   * with no command for saying so. Checked against the target's own columns and
   * rows: the commands port and the numbers do not. The app-side twin is
   * `ProgramPositions`.
   */
  positions: ProgramPositions | null;
  /**
   * BASIC line numbers opening a loop that counts and does nothing else - the
   * program's delays, written as the source machine's speed. See the app-side
   * twin.
   */
  emptyLoopLines: number[];
}

/**
 * What a program's text says about where it prints. The app-side twin is
 * `ProgramPositions` in `src/app/programVocabulary.ts`.
 *
 * Four collections because each form is checked differently: a whole position
 * against both of the target's dimensions, a bare column against its width, a
 * bare row against its height, and an offset against the whole screen and
 * against the width it silently encodes.
 */
export interface ProgramPositions {
  cells: { row: number; column: number }[];
  columns: number[];
  rows: number[];
  offsets: number[];
  /**
   * Which cell the machine calls the first one: 0 on the Sinclairs and the
   * Acorns, 1 on a CPC. What the numbers above mean, and so what they have to
   * be compared with a screen size against.
   */
  origin: 0 | 1;
  /** True where a position's value is not fixed by the program's text. */
  computed: boolean;
}

/**
 * What a program's text says about the screen modes it selects.
 *
 * `command` rides along because the vocabulary is read as the machine being
 * ported *from* and judged against the target's regions: a BBC `MODE 0` and an
 * Atom `CLEAR 0` are both mode 0 and are opposite ends of their machines'
 * graphics, so a reader whose region names a different command must decline to
 * decide rather than compare the numbers.
 */
export interface ScreenModeUse {
  /** The mode command, upper case, as the machine read spells it. */
  command: string;
  /** Modes selected with a constant argument, ascending and distinct. */
  modes: number[];
  /** True where a selection's value is not fixed by the program's text. */
  computed: boolean;
}

/**
 * One short spelling the program uses, and the command the source machine reads
 * it as. The app-side twin is `SpellingUse` in
 * `src/dialects/keywordSpellings.ts`; the two agree by field name across
 * `postMessage`, like {@link ProgramWriteSite} below.
 */
export interface ProgramSpelling {
  spelling: string;
  keyword: string;
}

/** One address the program writes to. The app-side twin is
 *  `ProgramWriteSite` in `src/app/programVocabulary.ts`. */
export interface ProgramWriteSite {
  address: number;
  expr: string;
  computed: boolean;
  approximate: boolean;
  endAddress?: number;
  role?: 'load';
}

/** One address the program reads, or calls. The app-side twin is
 *  `ProgramReadSite` in `src/app/programVocabulary.ts`. */
export interface ProgramReadSite {
  address: number;
  expr: string;
  computed: boolean;
  approximate: boolean;
  endAddress?: number;
}

/** One block the document carries beside the program. The app-side twin is
 *  `ProgramCodeBlock` in `src/app/programVocabulary.ts`. */
export interface ProgramCodeBlock {
  name: string;
  address: number;
  size: number;
  kind: 'code' | 'memory';
}

/**
 * Narrow a keyword diff to the commands the program actually uses.
 *
 * The narrowing applies to the buckets {@link diffKeywords} *returned*, never to
 * the tables handed to it. This is the load-bearing decision of the whole
 * feature: narrowing the source table first would be a smaller diff and is
 * wrong, because every command the program did not use would vanish from the
 * source side and reappear as "newly available on the target", inverting the
 * meaning of the entire gains half of the page.
 *
 * So `newlyAvailable` and `unchanged` pass through untouched - the first is by
 * definition about what the program did not use (and has its own control), and
 * the second is a count of what the port does not have to touch. Only the three
 * buckets that are work for the reader are narrowed.
 */
export function diffForProgram(
  diff: KeywordDiff,
  vocabulary: ProgramVocabulary,
): KeywordDiff {
  const used = new Set(vocabulary.keywords);
  return {
    ...diff,
    mustReplace: diff.mustReplace.filter((e) => used.has(e.name)),
    renamed: diff.renamed.filter((r) => used.has(r.from.name)),
    behaviourChanged: diff.behaviourChanged.filter((c) => used.has(c.name)),
  };
}

/** The same-word-different-meaning warnings the program can actually hit. */
export function falseFriendsForProgram(
  warnings: FalseFriendWarning[],
  vocabulary: ProgramVocabulary,
): FalseFriendWarning[] {
  const used = new Set(vocabulary.keywords);
  return warnings.filter((w) => used.has(w.keyword));
}

/**
 * Narrow an escape diff to the control codes the program actually uses.
 *
 * A row claims byte values through its `codes` field - the leading byte only,
 * for the operand-carrying escapes, which is the same rule the program analyser
 * records them under. The table's single `'rest'` row is the catch-all raw-byte
 * escape: a used byte no row names is exactly what that row stands for, so it
 * survives rather than the code disappearing from the comparison.
 *
 * Rows claiming no codes at all are the parse-only spellings, whose bytes
 * decode to another row's form; the row that owns those bytes is the one that
 * shows.
 *
 * `mustReplace` and `behaviourChanged` are both narrowed; `newlyAvailable` and
 * `unchanged` pass through untouched, for the reasons {@link diffForProgram}
 * gives. A behaviour-changed code is judged on its *source* row, which is the
 * one the program's bytes belong to - the target row is what it becomes.
 */
export function escapeDiffForProgram(
  diff: EscapeDiff,
  vocabulary: ProgramVocabulary,
): EscapeDiff {
  const used = new Set(vocabulary.escapeCodes);
  const claimed = new Set<number>();
  for (const entry of diff.mustReplace) {
    if (entry.codes && entry.codes !== 'rest') {
      for (const code of entry.codes) claimed.add(code);
    }
  }
  const unclaimed = [...used].some((code) => !claimed.has(code));
  return {
    ...diff,
    mustReplace: diff.mustReplace.filter((entry) => {
      if (entry.codes === 'rest') return unclaimed;
      return (entry.codes ?? []).some((code) => used.has(code));
    }),
    behaviourChanged: diff.behaviourChanged.filter((change) =>
      used.has(leadingByte(change.from)),
    ),
  };
}

/**
 * The byte a row's spelling produces, for narrowing a behaviour change.
 *
 * `codes` where the row claims any, and the row's own worked example otherwise.
 * The fallback is not a nicety: `codes` is documented as omitted for the
 * parse-only spellings, and on the Sinclair pages *every* block-graphics row is
 * parse-only - the canonical decode is the unicode glyph, which those rows carry
 * as an alias rather than as a row of its own. Narrowing on `codes` alone would
 * therefore discard the entire ZX80↔ZX81 finding, which is the one this bucket
 * exists for.
 *
 * `example.bytes` is safe to read this way: every row carries one, and
 * escapes/escape-crosscheck.test.ts pins each to what the dialect charset
 * actually produces. The leading byte only, which is the rule the program
 * analyser records operand-carrying escapes under.
 */
function leadingByte(entry: EscapeEntry): number {
  if (entry.codes !== undefined && entry.codes !== 'rest') {
    return entry.codes[0] ?? -1;
  }
  return entry.example.bytes[0] ?? -1;
}

/**
 * The characters the program uses that the target machine cannot represent.
 *
 * Narrowed like every other finding, and for the same reason: the target's whole
 * shortfall is a property of the machine, while what this port has to deal with
 * is the intersection with the program. A ZX81 lacks sixteen printable
 * characters; a particular program is usually subject to one or two of them.
 *
 * Case-folded, because the machines with the shortest repertoires are the
 * uppercase-only ones: a program writing `Hi!` is subject to the missing `!`,
 * and its lowercase letters are not a finding - they fold to letters the machine
 * has.
 */
export function unsupportedCharactersForProgram(
  targetFacts: PortingFacts,
  vocabulary: ProgramVocabulary,
): string[] {
  const missing = new Set(targetFacts.unsupportedCharacters);
  return vocabulary.characters.filter(
    (c) => missing.has(c) || missing.has(c.toUpperCase()),
  );
}

/** Two or more of the program's names that the target treats as one. */
export interface VariableCollision {
  /**
   * What the target reduces them to, marker included where it keeps one.
   *
   * Reported alongside the names because it is what makes the finding
   * actionable: a reader choosing a new name has to know what the old ones
   * became, so the replacement does not collide with a third.
   */
  key: string;
  /** The program's own spellings that reduce to it, sorted. */
  names: string[];
}

/**
 * What the target machine keeps of one name: its significant characters, plus
 * the type marker where the machine counts that as part of the name, in the
 * letter case it tells apart.
 *
 * Case belongs here rather than beside it, because it is the same question the
 * significant characters ask - how much of what the reader wrote does this
 * machine keep? A machine that folds keeps less, and two names a case-sensitive
 * source held apart arrive as one.
 */
function significanceKey(name: string, rule: VariableSignificance): string {
  name = foldNameCase(name, rule.caseSensitive);
  const last = name[name.length - 1] ?? '';
  const marker = rule.markers.includes(last) ? last : '';
  const stem = marker === '' ? name : name.slice(0, -1);
  const significant = marker === '' ? rule.plain : rule.marked;
  const kept = significant === null ? stem : stem.slice(0, significant);
  return kept + (rule.markerDistinguishes ? marker : '');
}

/**
 * The program's variable names that the target machine cannot tell apart.
 *
 * The silent failure this whole section exists for: nothing fails to tokenize,
 * no difference list has a row for it, and the program computes the wrong
 * answer because two of its variables have quietly become one.
 *
 * Names are grouped by the key the *target's* rule produces, and a bucket
 * holding one name is not a finding. A bucket whose names the *source* already
 * reduces to one key is dropped: that collision is not something the port
 * introduces, the program has it already, and the editor's own variable lint has
 * flagged it on the machine the program is written for. What survives is
 * exactly what the reader would acquire by moving.
 *
 * Empty where the target keeps at least as much of a name as the source, and
 * empty where there is no program: which names collide is a fact about a
 * program, not about a pair of machines.
 */
export function variableCollisionsForProgram(
  sourceFacts: PortingFacts,
  targetFacts: PortingFacts,
  vocabulary: ProgramVocabulary,
): VariableCollision[] {
  const target = targetFacts.variableSignificance;
  const source = sourceFacts.variableSignificance;
  const buckets = new Map<string, Set<string>>();
  for (const name of vocabulary.variables) {
    const key = significanceKey(name, target);
    const bucket = buckets.get(key);
    if (bucket) bucket.add(name);
    else buckets.set(key, new Set([name]));
  }

  const collisions: VariableCollision[] = [];
  for (const [key, names] of buckets) {
    if (names.size < 2) continue;
    // Already one variable on the machine the program was written for, so the
    // port is not what merges them.
    const onSource = new Set([...names].map((n) => significanceKey(n, source)));
    if (onSource.size < 2) continue;
    collisions.push({ key, names: [...names].sort() });
  }
  return collisions.sort((a, b) => a.key.localeCompare(b.key));
}

/** Arithmetic in this program that the target truncates. See {@link truncatedArithmeticForProgram}. */
export interface TruncatedArithmetic {
  /** True where the program's code divides. */
  divides: boolean;
  /** True where it carries a fractional literal. */
  fractionalLiteral: boolean;
  /** The range the target holds, which every rescaled value has to fit. */
  min: number;
  max: number;
  /**
   * The separate number system the target offers reals through, where it has
   * one - the Atom's floating-point ROM. Absent on a target whose only numbers
   * are the whole ones above, which is where rescaling is the only answer.
   *
   * Carried on the finding rather than looked up beside it because it is what
   * turns the advice into a decision: fractions the program depends on belong
   * in that system, fractions incidental to it are rescaled, and which they are
   * is not decidable from the program's text.
   */
  fractionsVia?: string;
}

/**
 * The arithmetic in this program that an integer-only target truncates, or null.
 *
 * Null in the two ways this is not work: the target has fractions, or the
 * program neither divides nor carries a fractional value. The fact row already
 * reports the difference in number handling either way; this is what it costs
 * *this* program.
 *
 * A division that only ever divides exactly is still reported. Proving otherwise
 * means running the program, so this is arithmetic to check rather than a defect
 * found - which is also why the two facts stay apart, so the finding can say
 * which of them applies.
 */
export function truncatedArithmeticForProgram(
  targetFacts: PortingFacts,
  vocabulary: ProgramVocabulary,
): TruncatedArithmetic | null {
  const { fractions, range, fractionsVia } = targetFacts.numbers;
  if (fractions || range === undefined) return null;
  if (!vocabulary.divides && !vocabulary.fractionalLiteral) return null;
  return {
    divides: vocabulary.divides,
    fractionalLiteral: vocabulary.fractionalLiteral,
    min: range.min,
    max: range.max,
    ...(fractionsVia !== undefined ? { fractionsVia } : {}),
  };
}

/** What a narrower integer range costs this program. See {@link integerRangeNarrowingForProgram}. */
export interface IntegerRangeNarrowing {
  /** The range the source machine holds. */
  from: { min: number; max: number };
  /** The range the target holds, which reaches less far. */
  to: { min: number; max: number };
  /**
   * The values in the program's own text the target cannot hold, ascending.
   *
   * Often empty, and an empty list is not an all-clear: it says the program
   * writes no such literal, not that its arithmetic stays inside the range. The
   * finding is present either way, and the decision it poses is what covers the
   * half no literal shows.
   */
  values: number[];
}

/**
 * What the target's narrower integer range costs this program, or null.
 *
 * Null in the three ways this is not work: either machine has fractions - a
 * fractional target holds the source's whole numbers, and a fractional *source*
 * is the truncation finding's business, not this one - or the target reaches at
 * least as far as the source in both directions.
 *
 * Present whenever a program is at hand for a narrowing pair, literals or not.
 * A 32-bit program moving to a 16-bit machine can overflow in an expression
 * whose every literal is small, so absence of large literals must not read as
 * safety; the literals sharpen the finding rather than triggering it.
 */
export function integerRangeNarrowingForProgram(
  sourceFacts: PortingFacts,
  targetFacts: PortingFacts,
  vocabulary: ProgramVocabulary,
): IntegerRangeNarrowing | null {
  const from = sourceFacts.numbers;
  const to = targetFacts.numbers;
  if (from.fractions || to.fractions) return null;
  if (from.range === undefined || to.range === undefined) return null;
  if (to.range.max >= from.range.max && to.range.min <= from.range.min) {
    return null;
  }
  return {
    from: from.range,
    to: to.range,
    // Magnitudes, as the census records them: a leading `-` is an operator
    // rather than part of the literal, and every integer range here reaches at
    // least as far below zero as above it, so a magnitude past the ceiling is
    // out of range whichever sign the program wrote it with.
    values: vocabulary.largeNumbers.filter((v) => v > to.range!.max),
  };
}

/** A type marker the target does not have. See {@link markerLossForProgram}. */
export interface MarkerLoss {
  /** The marker character, as the program's own names carry it. */
  marker: string;
  /** What it promised on the source machine: "integer", "double precision". */
  meaning: string;
  /** The program's names carrying it, sorted. */
  names: string[];
  /**
   * What the target does with the spelling where it takes it and fails when the
   * line runs, from the target's own authored trap. Absent where the marker is
   * simply not part of a name there, which is a rename rather than a trap.
   */
  trap?: string;
  /**
   * True where the marker named more precision than the target's ordinary
   * numbers hold, so the values keep flowing with digits missing rather than
   * failing.
   */
  precision: boolean;
}

/**
 * What each type marker promises, uniform across every registered machine that
 * declares one.
 *
 * `$` is deliberately absent, and absence is what keeps it out of the finding:
 * every machine here that has markers at all has `$`, so it is never lost, and
 * the Atom - which has no markers - reads `$` as a prefix operator rather than
 * as a suffix a name could carry.
 *
 * `finer` marks the marker naming more precision than an ordinary BASIC number
 * on these machines. Every registered machine's ordinary number is single
 * precision or thereabouts, so a `!` name keeps the precision it had and loses
 * only its spelling, while a `#` name loses digits on arrival.
 */
const MARKER_MEANINGS: Record<string, { meaning: string; finer: boolean }> = {
  '%': { meaning: 'integer', finer: false },
  '!': { meaning: 'single precision', finer: false },
  '#': { meaning: 'double precision', finer: true },
};

/**
 * The type markers this program's names carry that the target does not have.
 *
 * The same class of silent failure as the collisions above, one question over:
 * those ask whether two names become one, and this asks what a name's marker
 * promised. A `%` moving to a machine with no integer type either fails when
 * the line runs or quietly stops meaning anything, and the program tokenizes
 * cleanly in both cases.
 *
 * Read against the *source's* own marker set as well as the target's, so a
 * character that is not a marker where the program was written is not treated
 * as one - the Atom's `$` is a prefix operator, and a machine whose rule never
 * declared a marker never loses it.
 *
 * Empty where there is no program: which markers a program leans on is a fact
 * about a program, not about a pair of machines.
 */
export function markerLossForProgram(
  sourceFacts: PortingFacts,
  targetFacts: PortingFacts,
  vocabulary: ProgramVocabulary,
): MarkerLoss[] {
  const source = sourceFacts.variableSignificance.markers;
  const target = targetFacts.variableSignificance.markers;
  const carried = new Map<string, Set<string>>();
  for (const name of vocabulary.variables) {
    const marker = name[name.length - 1] ?? '';
    if (!source.includes(marker) || target.includes(marker)) continue;
    if (MARKER_MEANINGS[marker] === undefined) continue;
    const names = carried.get(marker);
    if (names) names.add(name);
    else carried.set(marker, new Set([name]));
  }

  return [...carried]
    .map(([marker, names]) => {
      const { meaning, finer } = MARKER_MEANINGS[marker]!;
      const trap = targetFacts.markerTraps?.find((t) => t.marker === marker);
      return {
        marker,
        meaning,
        names: [...names].sort(),
        ...(trap !== undefined ? { trap: trap.note } : {}),
        // An integer-only target holds no precision to lose: what its numbers
        // do to a fractional value is the truncation finding's to report, and
        // saying it twice under two names would double one difference.
        precision: finer && targetFacts.numbers.fractions,
      };
    })
    .sort((a, b) => a.marker.localeCompare(b.marker));
}

/** What the target's line-number range does to this program. See {@link lineNumbersForProgram}. */
export interface LineNumberChange {
  /** The program's lowest and highest line numbers, as written. */
  lowest: number;
  highest: number;
  /** The range the target machine's editor accepts. */
  min: number;
  max: number;
  /** True where the program's lowest number is below what the target takes. */
  belowMinimum: boolean;
  /** True where its highest is above what the target takes. */
  aboveMaximum: boolean;
}

/**
 * What the target machine's line-number range does to this program, or null.
 *
 * Null in the three ways this is not work: the program carries no numbered line,
 * every number it uses lies inside the target's range, or there is no vocabulary
 * to read it from.
 *
 * The range compared against is the target *editor's* - what a porter has to
 * renumber into - so a machine that stores wider numbers in a loaded program
 * (the BBC, the Spectrum) is still reported honestly: those numbers cannot be
 * typed on it. See `PortingFacts.lineNumbers`.
 */
export function lineNumbersForProgram(
  targetFacts: PortingFacts,
  vocabulary: ProgramVocabulary,
): LineNumberChange | null {
  const used = vocabulary.lineNumbers;
  if (!used) return null;
  const { min, max } = targetFacts.lineNumbers;
  const belowMinimum = used.lowest < min;
  const aboveMaximum = used.highest > max;
  if (!belowMinimum && !aboveMaximum) return null;
  return {
    lowest: used.lowest,
    highest: used.highest,
    min,
    max,
    belowMinimum,
    aboveMaximum,
  };
}

/** One spelling the port has to write out. See {@link spellingExpansionsForProgram}. */
export interface SpellingExpansion {
  /** The spelling as the program writes it, e.g. "P." or "?". */
  spelling: string;
  /** The command it stands for on the machine the program came from. */
  keyword: string;
  /**
   * What the target reads this spelling as instead, where it has a meaning of
   * its own for it. Absent where the target simply has no reading, in which case
   * an unexpanded spelling fails and says so.
   *
   * This is the expansion that has to happen rather than the one that ought to:
   * `?` opens a PRINT on the Microsoft-family machines and is *byte
   * indirection* on the Acorns, so a program moved unexpanded does not fail
   * there - it writes to memory instead of printing, silently.
   */
  differentMeaning?: string;
}

/** The notation a spelling is written in, read off the spelling itself. */
function spellingStyle(spelling: string): 'dot' | 'shifted' | 'symbol' {
  if (spelling.endsWith('.')) return 'dot';
  return /^[a-z]+[A-Z]$/.test(spelling) ? 'shifted' : 'symbol';
}

/**
 * The program's spellings the target machine does not read as the same command.
 *
 * Mechanical work, and reported with the renames rather than the rewrites: the
 * command survives the port and only its spelling changes. A spelling the target
 * reads identically earns no finding at all - there is nothing in it to do.
 *
 * Prefix notations are compared by style rather than by re-resolving them on the
 * target, which is what keeps this module free of the dialect tables: `P.` moved
 * between two machines that both take dot entry is left alone, and moved to a
 * machine that takes none it is reported. The two machines that take each
 * notation are close relatives running the same lookup order, so a prefix they
 * would resolve differently does not arise; a family that grew one would need
 * the resolution order here.
 *
 * Nothing at all where there is no program: which spellings a listing uses is a
 * fact about a program, not about a pair of machines.
 */
export function spellingExpansionsForProgram(
  targetFacts: PortingFacts,
  vocabulary?: ProgramVocabulary,
): SpellingExpansion[] {
  if (!vocabulary) return [];
  const entry = targetFacts.abbreviatedEntry;
  const out: SpellingExpansion[] = [];

  for (const { spelling, keyword } of vocabulary.spellings) {
    const style = spellingStyle(spelling);
    const read =
      style === 'symbol'
        ? entry.symbols.some(
            (s) => s.spelling === spelling && s.keyword === keyword,
          )
        : entry.style === style;
    if (read) continue;
    // The one trap worth naming: a machine that writes memory through `?` reads
    // the unexpanded spelling perfectly well, as something else.
    const indirection = spelling === '?' && writesByIndirection(targetFacts);
    out.push({
      spelling,
      keyword,
      ...(indirection ? { differentMeaning: 'byte indirection' } : {}),
    });
  }
  return out;
}

/**
 * Abbreviation offered as a way to make room. See
 * {@link shortSpellingsForFit}.
 */
export interface ShortSpellingMeasure {
  /** The notation the target's own editor takes. */
  style: 'dot' | 'shifted';
  /** How pressed the fit is, so the measure can be worded against it. */
  verdict: FitVerdict;
}

/**
 * The target's own short spellings, where they would genuinely make room.
 *
 * Gated twice, and both gates matter. On a machine that stores a token for each
 * keyword however it was typed, abbreviating saves nothing at all, so the
 * measure is never offered there whatever the fit - which is the difference
 * between a fit measure and advice to write unreadable code. And it is offered
 * only under pressure: a program with room to spare has no reason to give up
 * its spelling. The pressure is {@link fitIsPressed}, shared with the memory
 * the target conditionally holds free - the two ways of making room appear
 * together or not at all.
 *
 * A measure rather than an instruction; the caller poses it as a decision, and
 * as something to reach for after the port runs.
 */
export function shortSpellingsForFit(
  targetFacts: PortingFacts,
  fit: ProgramFit | null,
): ShortSpellingMeasure | null {
  const entry = targetFacts.abbreviatedEntry;
  if (!entry.shrinksProgram || entry.style === 'none') return null;
  if (!fitIsPressed(fit)) return null;
  return { style: entry.style, verdict: fit.verdict };
}

/** How a program's statement layout has to change. See {@link statementLayoutForProgram}. */
export interface StatementLayoutChange {
  /**
   * `split` where the target takes one statement per line, so each affected line
   * becomes several; `reseparate` where it takes several under another
   * character, so only the separator changes. The two are different work - the
   * first renumbers everything after it, the second does not.
   */
  kind: 'split' | 'reseparate';
  /** The source machine's separator. Never null: a line cannot carry two statements without one. */
  from: string;
  /** The target's separator, or null where it takes one statement per line. */
  to: string | null;
  /** The program's own BASIC line numbers that carry more than one statement. */
  lines: number[];
  /**
   * How many lines the program becomes once split, and whether the target's
   * line-number range can hold that many. Present only for `split`: a
   * `reseparate` leaves the line count exactly as it was.
   */
  projected?: {
    /** Numbered lines the program has now. */
    from: number;
    /** Numbered lines it becomes: `from` plus every statement past the first. */
    to: number;
    /**
     * True where the target's range cannot hold `to` lines however they are
     * renumbered - tested against the tightest possible scheme, step one from
     * the target's own minimum, so a program this rejects fits under no scheme.
     */
    overflows: boolean;
  };
}

/**
 * What this program's statement layout costs on the target, or null.
 *
 * Null in all three of the ways this is not work: the two machines separate
 * statements alike, the program has no line carrying more than one statement, or
 * the source machine has no separator at all (in which case the vocabulary
 * reports no such lines either, and this is belt and braces).
 *
 * The counting is the vocabulary's, done in the source machine's language; this
 * only decides what the target makes of it.
 *
 * A `split` also carries what it does to the program's *size in lines*, because
 * splitting is the one thing a port does that creates line numbers - and the
 * target may not have enough of them. Reported even where it fits: a program
 * going from 60 lines to 190 is worth meeting before starting rather than after.
 */
export function statementLayoutForProgram(
  sourceFacts: PortingFacts,
  targetFacts: PortingFacts,
  vocabulary: ProgramVocabulary,
): StatementLayoutChange | null {
  const from = sourceFacts.statementSeparator;
  const to = targetFacts.statementSeparator;
  if (from === null) return null;
  if (from === to) return null;
  if (vocabulary.multiStatementLines.length === 0) return null;
  const change: StatementLayoutChange = {
    kind: to === null ? 'split' : 'reseparate',
    from,
    to,
    lines: vocabulary.multiStatementLines,
  };
  const numbered = vocabulary.lineNumbers?.count;
  if (change.kind === 'split' && numbered !== undefined) {
    const becomes = numbered + vocabulary.extraStatements;
    const { min, max } = targetFacts.lineNumbers;
    change.projected = {
      from: numbered,
      to: becomes,
      // The tightest renumbering the target allows: one line per number from
      // its own minimum. A program that will not fit that will not fit at all.
      overflows: min + becomes - 1 > max,
    };
  }
  return change;
}

/**
 * What one of the program's writes reaches on the target machine.
 *
 * Four verdicts, and they are what the region kinds support - no more:
 *
 *  - `same-kind` - the target keeps the same kind of thing there, somewhere
 *    else. Not "no work": the address itself is still wrong, which is exactly
 *    what the two maps are drawn to scale to show.
 *  - `different-kind` - the write reaches something else. A write aimed at
 *    system variables that lands in the BASIC program text corrupts the
 *    program, so both halves are named.
 *  - `read-only` - the target has ROM there and the write does nothing at all.
 *    Its own verdict rather than a case of the one above, because the failure
 *    looks like the statement having been skipped rather than like damage.
 *  - `outside` - the target's address space does not reach that far, so the
 *    write has nowhere to go.
 */
export type WriteLandingVerdict =
  | 'same-kind'
  | 'different-kind'
  | 'read-only'
  | 'outside';

/** Where one group of the program's writes lands. See {@link writeLandingsForProgram}. */
export interface WriteLanding {
  verdict: WriteLandingVerdict;
  /**
   * The region the source machine keeps at these addresses - what the program
   * aimed at. Absent only for an address outside the source's own space, which
   * every described map covers end to end.
   */
  from?: MemoryRegion;
  /** What the target keeps there. Absent exactly for the `outside` verdict. */
  to?: MemoryRegion;
  /** The addresses in this group, ascending and distinct. */
  addresses: number[];
  /**
   * True where any address in the group was only approximated, so the verdict
   * is an estimate. Kept rather than suppressed: an approximate address that
   * would change verdict a few bytes either way is the one a reader most wants
   * to look at.
   */
  approximate: boolean;
}

/** The region holding an address, or `undefined` above the map's address space. */
function regionAt(map: MemoryMap, address: number): MemoryRegion | undefined {
  return map.regions.find((r) => address >= r.start && address <= r.end);
}

function verdictFor(
  from: MemoryRegion | undefined,
  to: MemoryRegion | undefined,
): WriteLandingVerdict {
  if (to === undefined) return 'outside';
  if (to.kind === 'rom') return 'read-only';
  return from !== undefined && from.kind === to.kind
    ? 'same-kind'
    : 'different-kind';
}

/**
 * Findings worst-placed first, mildest last - the order the scenarios are
 * written in, and the order a porter meets the work: a write that corrupts
 * something, then one that silently does nothing, then one with nowhere to go,
 * then an address that only has to move.
 */
const VERDICT_ORDER: readonly WriteLandingVerdict[] = [
  'different-kind',
  'read-only',
  'outside',
  'same-kind',
];

/**
 * Where the program's writes land on the target machine.
 *
 * The comparison already marks these addresses on both maps - on the source's
 * because that is where the program aimed them, on the target's because that is
 * where they would land - and leaves the conclusion to the reader's eye. Two
 * bands of colour at the same height mean "this POKE now writes into the BASIC
 * program's own text", and nothing else on the page says it. This is that
 * sentence, and it is reachable by a reader who never scrolls the maps at all.
 *
 * The addresses are the source machine's, as the analyser resolved them, and
 * they are not re-resolved here: a write is judged where it points. A site that
 * writes a range is judged at its base, which is the address the maps mark it
 * at.
 *
 * Sites sharing a verdict are reported together where they share the regions
 * that produced it, so a loop of eight POKEs into one buffer is one finding with
 * eight addresses. Both regions are part of that grouping and not only the
 * target's: a finding names what the program aimed at as well as what it
 * reaches, and two sites aimed at different things have not made one finding.
 *
 * Empty where either machine's layout is undescribed, which is the same
 * condition that leaves the maps themselves unshown - half a comparison of two
 * address spaces is worse than none - and empty where the program writes to
 * nothing.
 */
export function writeLandingsForProgram(
  fromMap: MemoryMap | undefined,
  toMap: MemoryMap | undefined,
  vocabulary: ProgramVocabulary,
): WriteLanding[] {
  if (fromMap === undefined || toMap === undefined) return [];
  const groups = new Map<string, WriteLanding>();
  for (const site of vocabulary.writeSites) {
    const from = regionAt(fromMap, site.address);
    const to = regionAt(toMap, site.address);
    const verdict = verdictFor(from, to);
    const key = `${verdict}|${from?.start ?? 'none'}|${to?.start ?? 'none'}`;
    const found = groups.get(key);
    if (found === undefined) {
      groups.set(key, {
        verdict,
        from,
        to,
        addresses: [site.address],
        approximate: site.approximate,
      });
      continue;
    }
    // The same address twice is one address: a program poking a hardware
    // register in two places has one finding to answer for, not two.
    if (!found.addresses.includes(site.address)) {
      found.addresses.push(site.address);
    }
    found.approximate = found.approximate || site.approximate;
  }

  for (const landing of groups.values()) {
    landing.addresses.sort((a, b) => a - b);
  }
  return [...groups.values()].sort(
    (a, b) =>
      VERDICT_ORDER.indexOf(a.verdict) - VERDICT_ORDER.indexOf(b.verdict) ||
      a.addresses[0]! - b.addresses[0]!,
  );
}

/**
 * What one of the program's reads reaches on the target machine.
 *
 * The write verdicts less one. `read-only` is a *write* verdict: a write into
 * ROM does nothing and the line looks skipped, while a read of ROM returns real
 * bytes on both machines - different bytes, which is the finding, and the same
 * finding as any other change of region. So a read landing in ROM falls to the
 * ordinary test, and is reported as reaching something else wherever the source
 * kept a different kind of thing there.
 */
export type ReadLandingVerdict = 'same-kind' | 'different-kind' | 'outside';

/** Where one group of the program's reads lands. See {@link readLandingsForProgram}. */
export interface ReadLanding {
  verdict: ReadLandingVerdict;
  /** The region the source machine keeps at these addresses - what the program
   *  was really asking for: the keyboard, the clock, the system variables. */
  from?: MemoryRegion;
  /** What the target keeps there. Absent exactly for the `outside` verdict. */
  to?: MemoryRegion;
  /** The addresses in this group, ascending and distinct. */
  addresses: number[];
  /** True where any address in the group was only approximated. */
  approximate: boolean;
}

/**
 * Worst-placed first, as the writes are: a read that quietly returns the wrong
 * thing, then one with nothing to read at all, then one that only has to move.
 */
const READ_VERDICT_ORDER: readonly ReadLandingVerdict[] = [
  'different-kind',
  'outside',
  'same-kind',
];

/**
 * Where the program's reads land on the target machine.
 *
 * The same shape as {@link writeLandingsForProgram}, and deliberately so: the
 * two findings sit beside each other and a reader should not have to learn a
 * second way of reading one. Grouped by verdict *and* by both regions, so a
 * loop reading eight bytes of one system variable block is one finding.
 *
 * Naming the source region is what makes this useful rather than merely true.
 * A read of the keyboard is reported as a read of the keyboard, on a machine
 * that says so in its own layout - and that is the whole of the "what should
 * this become" story, because the alternative is an address-by-address
 * substitution table this project could never pin.
 *
 * Empty where either machine's layout is undescribed - the condition that leaves
 * the maps themselves undrawn - and empty where the program reads nothing.
 */
export function readLandingsForProgram(
  fromMap: MemoryMap | undefined,
  toMap: MemoryMap | undefined,
  vocabulary: ProgramVocabulary,
): ReadLanding[] {
  if (fromMap === undefined || toMap === undefined) return [];
  const groups = new Map<string, ReadLanding>();
  for (const site of vocabulary.readSites) {
    const from = regionAt(fromMap, site.address);
    const to = regionAt(toMap, site.address);
    const verdict: ReadLandingVerdict =
      to === undefined
        ? 'outside'
        : from !== undefined && from.kind === to.kind
          ? 'same-kind'
          : 'different-kind';
    const key = `${verdict}|${from?.start ?? 'none'}|${to?.start ?? 'none'}`;
    const found = groups.get(key);
    if (found === undefined) {
      groups.set(key, {
        verdict,
        from,
        to,
        addresses: [site.address],
        approximate: site.approximate,
      });
      continue;
    }
    if (!found.addresses.includes(site.address)) {
      found.addresses.push(site.address);
    }
    found.approximate = found.approximate || site.approximate;
  }

  for (const landing of groups.values()) {
    landing.addresses.sort((a, b) => a - b);
  }
  return [...groups.values()].sort(
    (a, b) =>
      READ_VERDICT_ORDER.indexOf(a.verdict) -
        READ_VERDICT_ORDER.indexOf(b.verdict) ||
      a.addresses[0]! - b.addresses[0]!,
  );
}

/**
 * One routine the port has to re-achieve rather than translate.
 *
 * Either an address the program calls, or a block it carries that no call in its
 * text reaches - a block loaded and entered from outside the listing, or one the
 * scan could not resolve a call to. Both are machine code for the source machine
 * and neither survives the move, which is why they are one finding.
 */
export interface MachineCodeRoutine {
  /** The address, in the source machine's own space. */
  address: number;
  /** How the program reaches it - `SYS 49152`, `CALL 65507` - or absent for a
   *  block no call in the program's text lands in. */
  call?: string;
  /** The block this address sits inside, where the document carries one. */
  block?: ProgramCodeBlock;
  /** What the source machine's layout keeps at the address, where it describes
   *  one. Absent for a machine with no described layout. */
  region?: MemoryRegion;
  /** True where the call address could only be approximated. */
  approximate: boolean;
}

/** The block containing `address`, or undefined. A zero-length block holds no
 *  bytes and so contains nothing. */
function blockAt(
  blocks: ProgramCodeBlock[],
  address: number,
): ProgramCodeBlock | undefined {
  return blocks.find(
    (b) => b.size > 0 && address >= b.address && address < b.address + b.size,
  );
}

/**
 * The machine code this program reaches, as routines the port must re-achieve.
 *
 * Not landings: there is nothing to judge. A routine at 32768 is Z80 or 6502
 * written for one machine, and on the other it is at best absent - so the
 * finding is categorical, and the only question that moves the port forward is
 * what the routine was *for*. This gathers what there is to ask that about.
 *
 * A call that lands inside a block the document carries is reported as a call
 * into that block, which is the reading a person would give it; blocks no call
 * reaches follow, so a program that loads a routine and enters it from outside
 * the listing still has its code accounted for.
 *
 * Unlike the landings this is not gated on either machine's memory layout: what
 * the source machine keeps at the address is worth naming where it is known and
 * is not what makes the finding. Empty where the program calls nothing and the
 * document carries no blocks.
 */
export function machineCodeForProgram(
  fromMap: MemoryMap | undefined,
  vocabulary: ProgramVocabulary,
): MachineCodeRoutine[] {
  const blocks = vocabulary.codeBlocks;
  const routines: MachineCodeRoutine[] = [];
  const reached = new Set<string>();
  for (const site of vocabulary.callSites) {
    const block = blockAt(blocks, site.address);
    if (block) reached.add(block.name);
    routines.push({
      address: site.address,
      call: site.expr,
      ...(block ? { block } : {}),
      ...(fromMap ? { region: regionAt(fromMap, site.address) } : {}),
      approximate: site.approximate,
    });
  }
  routines.sort((a, b) => a.address - b.address);

  for (const block of blocks) {
    if (reached.has(block.name)) continue;
    routines.push({
      address: block.address,
      block,
      ...(fromMap ? { region: regionAt(fromMap, block.address) } : {}),
      approximate: false,
    });
  }
  return routines;
}

/**
 * Whether this pair's own guidance already says how machine code travels
 * between these two machines - the Sinclair notes about hidden-REM records and
 * `.TAP CODE` blocks are the case this exists for.
 *
 * The machine-code finding points at that guidance rather than restating it: the
 * carrier format is a fact about the pair, it is already written once, and the
 * reading budget the guidance is authored under does not survive saying it
 * twice under two headings.
 */
export function carriesMachineCodeGuidance(guidance: PairGuidance): boolean {
  return guidance.pairNotes.some((note) =>
    /machine code|CODE block/i.test(note),
  );
}

/** Where this program's layout falls on the target's screen. See
 *  {@link positionsForProgram}. */
export interface PositionCheck {
  /** The screen the source machine boots into - what the layout was aimed at. */
  from: TextScreen;
  /** The screen the target boots into - what it has to fit. */
  to: TextScreen;
  /** Whole positions the target's screen does not contain, in reading order. */
  cells: { row: number; column: number }[];
  /** Columns beyond the target's width, ascending. */
  columns: number[];
  /** Rows beyond the target's height, ascending. */
  rows: number[];
  /** Offsets the target's screen does not contain, ascending. */
  offsets: number[];
  /**
   * True where the program positions by single offset and the two screens
   * differ in width.
   *
   * The finding that has nothing to do with bounds: an offset counts cells
   * across a screen, so it *is* the source machine's width, and 200 on a
   * 64-column machine is row 3 column 8 while on a 40-column one it is row 5
   * column 0. Every offset has to be recomputed whether or not any of them is
   * out of range.
   */
  widthEncoded: boolean;
  /**
   * True where the program selects a screen mode other than the one its machine
   * boots into, so the check above describes a screen the program may have left.
   */
  otherModes: boolean;
}

/**
 * Whether the program selects a screen mode its machine did not boot into.
 *
 * The boot mode is not a field of the facts: the only machines with a mode
 * command are the ones whose conditionally free memory is decided by it, and
 * those regions name the mode they are free in. Where no region names one there
 * is no fact to decide with, and any selection at all counts - the caveat is
 * cheap and judging a geometry this cannot know is not.
 */
function selectsOtherModes(
  fromFacts: PortingFacts,
  vocabulary: ProgramVocabulary,
): boolean {
  const use = vocabulary.screenModes;
  if (use === null) return false;
  if (use.computed) return true;
  if (use.modes.length === 0) return false;
  const condition = (fromFacts.conditionallyFree ?? [])
    .map((region) => region.condition)
    .find((c) => c.kind === 'screen-modes' && c.command === use.command);
  if (condition === undefined || condition.kind !== 'screen-modes') return true;
  return use.modes.some((mode) => mode !== condition.bootMode);
}

/**
 * Where the program's stated positions fall on the target machine's screen.
 *
 * The finding no command list can carry: `PRINT AT 5,35` ports to a 32-column
 * machine as `PRINT AT 5,35`, and lands off the edge or wrapped. The screens
 * here run from 22 columns to 80, so this is not a corner case between two
 * unusual machines - it is most pairs.
 *
 * Positions the program states as constants only. A computed position is not
 * judged: doubt reports nothing, exactly as it does for a computed screen mode,
 * and the decision the report poses is what covers the rest.
 *
 * Null where there is nothing to say - no program positions, every one of them
 * inside the target's screen, and no offsets whose width has changed. Null too
 * where either machine's positions cannot be read at all, which is the case for
 * a source machine that lays its screen out by printing.
 */
export function positionsForProgram(
  fromFacts: PortingFacts,
  toFacts: PortingFacts,
  vocabulary: ProgramVocabulary,
): PositionCheck | null {
  const positions = vocabulary.positions;
  if (positions === null) return null;
  const to = toFacts.textScreen;
  // Positions are stated in the source machine's own origin - the Sinclairs and
  // the Acorns count from zero, Locomotive from one - so the offset comes off
  // before anything is compared with a size.
  const beyond = (value: number, extent: number): boolean =>
    value - positions.origin >= extent;

  const cells = positions.cells.filter(
    (cell) => beyond(cell.column, to.columns) || beyond(cell.row, to.rows),
  );
  const columns = positions.columns.filter((c) => beyond(c, to.columns));
  const rows = positions.rows.filter((r) => beyond(r, to.rows));
  const offsets = positions.offsets.filter((o) =>
    beyond(o, to.columns * to.rows),
  );
  const widthEncoded =
    positions.offsets.length > 0 && fromFacts.textScreen.columns !== to.columns;

  if (
    cells.length === 0 &&
    columns.length === 0 &&
    rows.length === 0 &&
    offsets.length === 0 &&
    !widthEncoded
  ) {
    return null;
  }
  return {
    from: fromFacts.textScreen,
    to,
    cells,
    columns,
    rows,
    offsets,
    widthEncoded,
    otherModes: selectsOtherModes(fromFacts, vocabulary),
  };
}

/**
 * How far apart two machines' measured speeds have to be before the delays a
 * program was tuned with are worth reporting.
 *
 * Half again as fast, either way. Below that a pause changes by less than the
 * length of itself and a reader has better things to read; at it, a two-second
 * countdown becomes three or one and a game's pace has changed. One constant
 * because the finding either fires or does not - a threshold per pair, or per
 * capability, would be a dial nobody could reason about.
 *
 * Comfortably outside what the measurement can wobble by: the benchmark pins
 * each machine's figure to within a fifth of itself
 * (`src/dialects/loopSpeedProbes.ts`), so no pair can reach this by drifting.
 */
export const MATERIAL_SPEED_RATIO = 1.5;

/** What this program's delay loops become on the target. See
 *  {@link delaysForProgram}. */
export interface DelayLoops {
  /** BASIC line numbers opening a loop that only counts. */
  lines: number[];
  /** Loop iterations a second on each machine, as measured in this IDE. */
  fromSpeed: number;
  toSpeed: number;
  /**
   * How the target's speed compares with the source's: 3 where the target runs
   * the same loop three times as fast, 0.25 where it takes four times as long.
   */
  ratio: number;
  /** How the target paces a wait, in its own terms. */
  clock: string;
  /**
   * Whether that is something a delay can actually be moved onto. False where
   * the machine has no timer and no pause at all - a real answer, and the one
   * that makes the decision a single course rather than a choice.
   */
  hasClock: boolean;
}

/**
 * The delays this program carries, and what the target's speed does to them.
 *
 * An empty counting loop is the source machine's speed written into the
 * program: the count is however many iterations of *that* interpreter filled
 * the pause its author wanted. Nothing about it fails to port - the loop
 * tokenizes, runs, and takes a different length of time.
 *
 * Null unless the program has such loops and the two machines' measured speeds
 * are materially apart. Null too where either machine has no measured speed,
 * since a ratio needs two: a comparison that cannot measure one side reports
 * nothing rather than guessing at it.
 */
export function delaysForProgram(
  fromFacts: PortingFacts,
  toFacts: PortingFacts,
  vocabulary: ProgramVocabulary,
): DelayLoops | null {
  const lines = vocabulary.emptyLoopLines;
  const fromSpeed = fromFacts.loopSpeed;
  const toSpeed = toFacts.loopSpeed;
  if (lines.length === 0 || fromSpeed === undefined || toSpeed === undefined) {
    return null;
  }
  const ratio = toSpeed / fromSpeed;
  if (ratio < MATERIAL_SPEED_RATIO && ratio > 1 / MATERIAL_SPEED_RATIO) {
    return null;
  }
  return {
    lines,
    fromSpeed,
    toSpeed,
    ratio,
    clock: toFacts.waitIdiom.text,
    hasClock: toFacts.waitIdiom.keywords.length > 0,
  };
}

/**
 * Whether a capability fact denies the capability outright.
 *
 * Prose, like every other hardware fact here, so this reads it - and
 * facts-crosscheck.test.ts pins the exact set of machines it answers true for,
 * so a reworded fact fails there rather than silently withdrawing a finding.
 */
function deniesCapability(fact: string): boolean {
  return /^none\b/i.test(fact.trim());
}

/**
 * The capabilities this program uses that the target machine simply does not
 * have, and so has to be asked about.
 *
 * A program uses colour and sound two ways. As decoration, which a port can
 * drop; and as information - the colour that tells the player's piece from the
 * wall, the beep that says the key registered - which a port must re-encode or
 * the program stops working in a way no listing shows. Which of the two a given
 * program is doing is not in its text, and the target's written advice for the
 * lost capability is only half an answer until it is decided.
 *
 * So the decision is posed rather than guessed, and posed where the loss is
 * already reported: the account for that capability, which the narrowing has
 * already reduced to the commands this program actually uses. Nothing is added
 * where the target has the capability under other means - the Commodores have
 * no colour *keywords* and sixteen colours, and telling a reader to consider
 * dropping their colour would be nonsense.
 */
export function lostCapabilitiesForProgram(
  targetFacts: PortingFacts,
  sections: CapabilitySection[],
): KeywordDomain[] {
  const denied: [KeywordDomain, string][] = [
    ['colour', targetFacts.colour],
    ['sound', targetFacts.sound],
  ];
  return denied
    .filter(([domain, fact]) => {
      if (!deniesCapability(fact)) return false;
      return sections.some((s) => s.domain === domain && s.entries.length > 0);
    })
    .map(([domain]) => domain);
}

/**
 * What the open program takes on the machine it is being ported *to*, as the IDE
 * reports it across the iframe boundary. Declared here for the same reason
 * {@link ProgramVocabulary} is: this module never reaches into `src/`, and the
 * two sides agree by field name, pinned by `DocsDrawer.test.ts`.
 *
 * Measured by the *target's* own tokenizer, which is the whole point of carrying
 * it: a program's stored size is not portable. The same six-line program is 50
 * bytes on a ZX80, 71 on the Microsoft-derived machines, 80 on the Sinclair
 * machines that keep a five-byte binary form after every numeric literal, and 88
 * on a CPC. Sizing a port from the source machine's byte count would be wrong by
 * a quarter before the comparison started.
 */
export interface ProgramSize {
  /** The machine this size answers for; only meaningful against that one. */
  dialectId: string;
  /** Bytes the program occupies in that machine's program area. */
  bytes: number;
  /** False where the target's tokenizer objected to any of the program. */
  clean: boolean;
}

/**
 * What can be claimed about the size.
 *
 * `at-least` is the one that earns its place. A tokenizer that cannot express a
 * line drops the *whole line*: a two-line ZX81 program measures 19 bytes clean
 * and 10 with one line unstorable. So a lower bound under the budget cannot be
 * called a fit - the part that was not measured is exactly the part that would
 * push it over - while a lower bound already over the budget is definitive,
 * because the real figure can only be larger.
 *
 * `tight` covers everything from the editor's warn threshold up to the last byte
 * that still fits; `severity` grades it, so a caller can tell "close to the
 * limit" from "no room left" without a fourth verdict meaning the same thing.
 */
export type FitVerdict = 'fits' | 'tight' | 'over' | 'at-least';

/** Whether the program fits the target, and by how much. See {@link programFitForTarget}. */
export interface ProgramFit {
  /** What the program takes on the target. */
  bytes: number;
  /** What the target has free for a BASIC program. */
  freeBytes: number;
  /** `bytes` as a share of `freeBytes`, clamped to 100 as the status bar clamps it. */
  percent: number;
  /** The same thresholds the editor's byte counter uses: ≥80% warn, ≥95% crit. */
  severity: RamSeverity;
  /** What the figure supports saying; see {@link FitVerdict}. */
  verdict: FitVerdict;
  /**
   * True where the target's tokenizer could not read all of the program, so the
   * real figure can only be larger. Not a failure to fit: a port normally
   * carries commands and characters the target has no way to store, and those
   * are what the rest of this page is about.
   */
  lowerBound: boolean;
}

/**
 * Whether the program fits the target machine's program memory.
 *
 * The one failure a port with no other work in it can still hit: C64 → VIC-20 is
 * byte-identical Commodore BASIC V2 landing in 3,583 bytes instead of 38,911, and
 * every keyword bucket on this page is empty for it.
 *
 * Not a narrowing of any table, unlike {@link diffForProgram} and its relatives -
 * it is a finding that exists only where there is a program, like
 * {@link statementLayoutForProgram}. So there is nothing for the "show every
 * difference" control to reveal here: a fit report about no program would be a
 * report about nothing.
 *
 * Null in two cases: the size answers for a machine other than the one whose facts
 * are given (the state between choosing a new target and being told what the
 * program measures on *that* machine), and a lower bound of nothing at all, where
 * the target could store no part of the program - "at least 0 bytes" is not a
 * finding, and what made it zero is reported by the rest of the page.
 */
export function programFitForTarget(
  targetFacts: PortingFacts,
  size: ProgramSize | null,
): ProgramFit | null {
  if (!size || size.dialectId !== targetFacts.id) return null;
  const lowerBound = !size.clean;
  if (lowerBound && size.bytes === 0) return null;
  const freeBytes = targetFacts.freeRamBytes;
  const { pct } = ramBudget(size.bytes, freeBytes);
  const severity = ramSeverity(pct);
  const verdict: FitVerdict =
    size.bytes > freeBytes
      ? 'over'
      : lowerBound
        ? 'at-least'
        : severity === 'ok'
          ? 'fits'
          : 'tight';
  return {
    bytes: size.bytes,
    freeBytes,
    percent: pct,
    severity,
    verdict,
    lowerBound,
  };
}

/**
 * Whether the program's own text proves `region` untouched.
 *
 * Pure, and strict in one direction only: everything it cannot decide reads as
 * "not free". A mode whose value the text does not fix, a vocabulary read as a
 * machine whose mode command is not the region's, a write landing inside the
 * region - each is a question this cannot answer, and doubt runs toward leaving
 * the memory claimed, exactly as the lower-bound rule runs it toward the larger
 * program.
 *
 * The write check comes first and applies to every form of condition: a program
 * that names no graphics mode at all but pokes the region directly is using the
 * memory, whatever its mode statements say.
 */
export function conditionallyFreeMet(
  region: ConditionalFreeMemory,
  vocabulary: ProgramVocabulary,
): boolean {
  const written = vocabulary.writeSites.some(
    (site) =>
      site.address <= region.end &&
      region.start <= (site.endAddress ?? site.address),
  );
  if (written) return false;

  const condition = region.condition;
  if (condition.kind === 'without-keywords') {
    return !condition.keywords.some((keyword) =>
      vocabulary.keywords.includes(keyword.toUpperCase()),
    );
  }
  const use = vocabulary.screenModes;
  // Read as a machine with no mode command of its own: nothing in the program
  // selects a mode on the target, so it stays in the one it powers on in.
  if (use === null) return condition.modes.includes(condition.bootMode);
  if (use.command !== condition.command) return false;
  if (use.computed) return false;
  if (use.modes.length === 0)
    return condition.modes.includes(condition.bootMode);
  return use.modes.every((mode) => condition.modes.includes(mode));
}

/**
 * Memory the target holds that this program may take, reported only where the
 * fit report has already called the program close to the limit or over it.
 *
 * The gate is the whole of what squares this with the rule that the comparison
 * never advertises what the target adds. Under pressure the memory is not an
 * advertisement but part of the answer to "does it fit"; with room to spare it
 * is a feature the reader did not ask about. And an unmet condition reports
 * nothing at all, because "rewrite the program and this memory appears" is
 * precisely the advertisement the rule forbids.
 *
 * `at-least` is not pressure: see {@link fitIsPressed}.
 */
export function conditionallyFreeForProgram(
  targetFacts: PortingFacts,
  vocabulary: ProgramVocabulary,
  fit: ProgramFit | null,
): ConditionalFreeMemory[] {
  if (!fitIsPressed(fit)) return [];
  return (targetFacts.conditionallyFree ?? []).filter((region) =>
    conditionallyFreeMet(region, vocabulary),
  );
}

/**
 * Whether the fit report has the program close to the target's limit or over
 * it - the pressure every measure that makes room is gated on.
 *
 * One predicate rather than one per measure, so the page cannot come to offer a
 * reader the target's short spellings while withholding the memory it holds, or
 * the other way about. Both are answers to "it does not fit"; they have to
 * appear together or not at all.
 *
 * `at-least` is not pressure: a lower bound says neither that the program is
 * close to the limit nor that it is over, and a lower bound that *is* over is
 * reported as `over` by {@link programFitForTarget} and gates here on that.
 */
export function fitIsPressed(fit: ProgramFit | null): fit is ProgramFit {
  return fit !== null && (fit.verdict === 'tight' || fit.verdict === 'over');
}

/**
 * Where the comparison stands with respect to the open program. One resolver
 * rather than a chain of conditions in the template, because the page must
 * *always* say where it stands - narrowed, or not narrowed and what would
 * narrow it - and a template growing one more `v-else-if` is how a combination
 * ends up saying nothing.
 *
 * `reading` is the state between choosing a different source machine and being
 * told what the program looks like in *that* language: a vocabulary describes
 * one BASIC, so a reply for another machine is not an answer to the question on
 * screen. The page re-asks whenever the source machine changes, so it is brief.
 */
export type NoticeKind =
  | 'standalone'
  | 'no-program'
  | 'unreadable'
  | 'reading'
  | 'narrowed';

export interface NoticeState {
  kind: NoticeKind;
  /** True when the reported differences are actually being narrowed. */
  narrowed: boolean;
  /** True when the control that reveals everything applies to this state. */
  offerControl: boolean;
}

export function noticeState(input: {
  /** True only inside the IDE's docs drawer. */
  embedded: boolean;
  /** The reply the IDE last sent, or null before one has arrived. */
  vocabulary: ProgramVocabulary | null;
  /** The reply's status; ignored when there is no reply. */
  status: 'ready' | 'empty' | 'unreadable' | null;
  /** The machine currently being ported *from*. */
  sourceDialectId: string;
  /** True when the reader has asked to see every difference. */
  showAll: boolean;
}): NoticeState {
  const plain = { narrowed: false, offerControl: false };
  if (!input.embedded) return { kind: 'standalone', ...plain };
  if (input.vocabulary === null || input.status === null)
    return { kind: 'reading', ...plain };
  if (input.status === 'empty') return { kind: 'no-program', ...plain };
  if (input.status === 'unreadable') return { kind: 'unreadable', ...plain };
  if (input.vocabulary.dialectId !== input.sourceDialectId)
    return { kind: 'reading', ...plain };
  return { kind: 'narrowed', narrowed: !input.showAll, offerControl: true };
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

/** One row of the language & hardware comparison table. */
export interface FactRow {
  label: string;
  fromText: string;
  toText: string;
  /** True when the two machines answer this row differently. */
  changed: boolean;
}

function fmtSeparator(f: PortingFacts): string {
  return f.statementSeparator
    ? `Multiple, separated by "${f.statementSeparator}"`
    : 'One statement per line';
}
function fmtElse(f: PortingFacts): string {
  return f.elseSupported ? 'IF … THEN … ELSE' : 'IF … THEN only (no ELSE)';
}
function fmtLet(f: PortingFacts): string {
  return {
    required: 'Required (LET x=…)',
    optional: 'Optional',
    none: 'Not used',
  }[f.letRequired];
}
function fmtRam(f: PortingFacts): string {
  return `${f.freeRamBytes.toLocaleString('en-GB')} bytes`;
}
function fmtCharacters(f: PortingFacts): string {
  return f.unsupportedCharacters.length === 0
    ? 'All printable ASCII'
    : `No ${f.unsupportedCharacters.join(' ')}`;
}
/**
 * Integer division and remainder as one row: they travel together, and a
 * machine that has neither needs the arithmetic that replaces both.
 */
function fmtIntegerArithmetic(f: PortingFacts): string {
  const parts = [
    f.integerDivisionOperator && `${f.integerDivisionOperator} divides`,
    f.remainderOperator && `${f.remainderOperator} remainders`,
  ].filter(Boolean);
  return parts.length === 0
    ? 'Neither - use INT(a/b) and a-b*INT(a/b)'
    : parts.join(', ');
}
/** Bitwise, Sinclair value or true/false logic, with exclusive-OR folded in. */
function fmtLogicalOperators(f: PortingFacts): string {
  if (f.logicalOperators === 'value') {
    return 'Value logic - A AND B is A or 0, not a bit pattern';
  }
  if (f.logicalOperators === 'logical') {
    return 'True/false logic - A AND B is 1 or 0, not a bit pattern';
  }
  return f.xorOperator
    ? `Bitwise on integers; ${f.xorOperator} for exclusive-OR`
    : 'Bitwise on integers; no exclusive-OR operator';
}
function fmtComparisonTrue(f: PortingFacts): string {
  return `${f.comparisonTrue} for true, 0 for false`;
}
/**
 * How short a keyword may be written on this machine, and which symbols stand
 * for a whole command.
 *
 * Both halves, because a machine may have one without the other: the Acorns
 * take a dotted prefix and no symbol, the TRS-80 no prefix and two symbols.
 */
function fmtAbbreviatedEntry(f: PortingFacts): string {
  const { style, symbols } = f.abbreviatedEntry;
  const short = symbols.map((s) => `${s.spelling} for ${s.keyword}`).join(', ');
  if (style === 'none') {
    return short === '' ? 'None' : `No prefix abbreviation; ${short}`;
  }
  const prefix =
    style === 'dot'
      ? 'Dotted prefix (P. for PRINT)'
      : 'Shifted last letter (pO for POKE)';
  return short === '' ? prefix : `${prefix}; ${short}`;
}
function fmtAddress(f: PortingFacts): string {
  if (f.addressNotation === 'hex') {
    return f.hexPrefix ? `Hexadecimal (${f.hexPrefix}nn)` : 'Hexadecimal';
  }
  return 'Decimal';
}

/**
 * The comparison table's rows, in the order a porter meets the work - most
 * consequential first. The order is the content here, so it is pinned by
 * `compare-facts-crosscheck.test.ts` rather than left to whoever edits next.
 *
 * The BASIC each machine runs leads: it is what the rest of the table is about,
 * it is the one row that says outright whether this is a port between two
 * BASICs or between two versions of one, and for the four families that share a
 * reference page it is the difference the page title cannot show.
 *
 * Then the differences by how much of the program they touch. Arithmetic and
 * free RAM decide whether the program can work at all - an integer-only target
 * rescales every fractional calculation, and 3,583 bytes is a rewrite a C64
 * program does not survive by editing keywords. The language rules that follow
 * force edits wherever they apply (two significant characters renames
 * variables; no ELSE restructures conditionals) but leave the program's shape
 * alone. The hardware the program draws and sounds on comes next.
 *
 * The memory facts close it as one run: how memory is written, then how an
 * address is spelled. They are the only rows that matter solely to a program
 * that pokes at hardware, and they were previously scattered - the notation
 * five rows away from the write syntax it describes.
 *
 * The addresses themselves are not here. A screen base and a program start were
 * the last two rows of this run until the Memory layout section started drawing
 * both machines' whole address spaces to scale; two numbers and the picture that
 * explains them are one difference reported twice, and the picture is the one a
 * porter can act on. The facts still carry those addresses (the assistant is
 * told them, and facts-crosscheck.test.ts pins them to each machine's real
 * memory map) - they simply have a better place to be read.
 */
const FACT_ROWS: readonly [string, (f: PortingFacts) => string][] = [
  ['BASIC dialect', (f) => f.basicDialect],
  // Whether the target has fractions at all decides how much of the port is
  // arithmetic, so it leads the language rules rather than sitting among the
  // hardware.
  ['Numbers', (f) => f.numberHandling],
  ['Free program RAM', fmtRam],
  ['Variable names', (f) => f.variableNaming],
  ['Conditionals', fmtElse],
  ['Statements per line', fmtSeparator],
  ['LET on assignment', fmtLet],
  // A language rule about the program's *text*: a spelling the target does not
  // read stops the line being read at all, wherever the command exists on both.
  ['Abbreviated entry', fmtAbbreviatedEntry],
  // With the language rules rather than the hardware: a character the machine
  // has no glyph for is rejected when the program is read, not when it draws.
  ['Characters', fmtCharacters],
  // The operator run. Three rows rather than one, and together rather than
  // scattered, because they are read for the same reason: an expression that
  // survives the port unchanged and quietly computes something else. Only the
  // first of them fails loudly.
  ['Exponent operator', (f) => f.exponentOperator ?? 'None'],
  ['Integer division and remainder', fmtIntegerArithmetic],
  ['AND, OR and NOT', fmtLogicalOperators],
  ['Comparisons yield', fmtComparisonTrue],
  ['Line numbers', (f) => f.lineNumberRange],
  ['Screen', (f) => f.screen],
  ['Colour', (f) => f.colour],
  ['Sound', (f) => f.sound],
  ['Writing memory', (f) => f.memoryWriteSyntax],
  ['Address notation', fmtAddress],
  // The memory run ends here. The screen base and the program start used to
  // follow it as two rows of numbers; the Memory layout section draws them in
  // place, to scale, against everything else in the address space, so reporting
  // them here as well would give one difference twice.
];

/** Every row label the table shows, top to bottom. */
export const factRowLabels: readonly string[] = FACT_ROWS.map(
  ([label]) => label,
);

/**
 * The full table for a pair of machines, in {@link factRowLabels} order. The
 * page shows the `changed` rows by default and the rest on request, so every
 * row is built either way.
 */
export function factRows(
  source: PortingFacts,
  target: PortingFacts,
): FactRow[] {
  return FACT_ROWS.map(([label, get]) => {
    const fromText = get(source);
    const toText = get(target);
    return { label, fromText, toText, changed: fromText !== toText };
  });
}
