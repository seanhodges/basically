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
} from './types';
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
  escapeCodes: number[];
  /** Printable ASCII the program's text contains. See the app-side twin. */
  characters: string[];
  /** 1-based editor lines carrying more than one statement. */
  multiStatementLines: number[];
  /**
   * The addresses the program writes to, resolved for the machine it was read
   * as. Marked on both machines' memory layouts: on the source's because that
   * is where the program aimed them, and on the target's because that is where
   * they would land.
   */
  writeSites: ProgramWriteSite[];
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
  /** The program's 1-based editor lines that carry more than one statement. */
  lines: number[];
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
  return {
    kind: to === null ? 'split' : 'reseparate',
    from,
    to,
    lines: vocabulary.multiStatementLines,
  };
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
  // With the language rules rather than the hardware: a character the machine
  // has no glyph for is rejected when the program is read, not when it draws.
  ['Characters', fmtCharacters],
  ['Exponent operator', (f) => f.exponentOperator ?? 'None'],
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
