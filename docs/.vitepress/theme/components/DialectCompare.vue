<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
  type ComputedRef,
} from 'vue';
import type {
  EscapeTableData,
  PortingFacts,
  ReferenceTableData,
} from '../../../../src/reference/types';
import {
  capabilitySections,
  composeGuidance,
  diffEscapes,
  diffForProgram,
  diffKeywords,
  escapeDiffForProgram,
  escapeSections,
  escapeTableForMachine,
  falseFriendsForProgram,
  noticeState,
  statementLayoutForProgram,
  tableForMachine,
  unsupportedCharactersForProgram,
  type CapabilitySection,
  type EscapeSection,
  type KeywordChange,
  type ProgramVocabulary,
} from '../../../../src/reference/compare';
import {
  falseFriends,
  keywordEquivalences,
  pairPortingNotes,
} from '../../../../src/reference/porting';
import { domainGuidance } from '../../../../src/reference/domain-guidance';
import type { DomainGuidance } from '../../../../src/reference/domain-guidance';
import { DOMAIN_META, DOMAIN_ORDER } from '../domainMeta';
import { useDeepLinkParams } from '../deepLinkParams';

/**
 * One selectable machine.
 *
 * The reference and escape tables belong to the *page*, which may cover several
 * machines; `id` is what narrows them to one (see `tableForMachine`). Facts
 * belong to the machine outright.
 *
 * Only machines are selectable - a page slug is not. `zxspectrum` is both the
 * 48K machine's id and the page its 128K sibling shares, so admitting slugs to
 * the same `?from=`/`?to=` namespace would leave that string meaning two things
 * with no way to say which.
 */
interface DialectOption {
  /** Dialect id. The value used in `?from=`/`?to=`. */
  id: string;
  /** Reference page slug (e.g. "cpc"), for reference links and pair data. */
  page: string;
  /**
   * The four fields the machine picker reads beyond `id`, which together make
   * this a `MachineLike` (src/components/machinePicker.ts) - the guide renders
   * the IDE's own picker, so it supplies what that picker asks of a machine.
   * `name` is also what every sentence on this page calls the machine.
   */
  name: string;
  manufacturer: string;
  year: number;
  blurb: string;
  reference: ReferenceTableData;
  escapes?: EscapeTableData;
  facts: PortingFacts;
}

const props = defineProps<{ dialects: DialectOption[] }>();

// Message types the embedded app listens for (src/components/DocsDrawer.tsx).
// Kept in sync with that file by string, like DOCS_CLOSE_MESSAGE there, and
// pinned by its DocsDrawer.test.ts - nothing typechecks across an iframe.
const CONVERT_MESSAGE = 'basically:compare-convert';
const VOCABULARY_REQUEST = 'basically:program-vocabulary-request';
const VOCABULARY_MESSAGE = 'basically:program-vocabulary';

// The pair the page opens on when the URL names no `?from=`/`?to=`: the two
// most-used machines, and a genuinely instructive port (integer-ish Microsoft
// BASIC with PEEK/POKE graphics → a machine with PLOT/DRAW/CIRCLE and colour).
// Falls back to the first two options if either id is ever unregistered.
const DEFAULT_FROM = 'commodore64';
const DEFAULT_TO = 'zxspectrum';

function defaultId(preferred: string, fallbackIndex: number): string {
  if (props.dialects.some((d) => d.id === preferred)) return preferred;
  return props.dialects[fallbackIndex]?.id ?? props.dialects[0]?.id ?? '';
}

const from = ref(defaultId(DEFAULT_FROM, 0));
const to = ref(defaultId(DEFAULT_TO, 1));
const showUnchanged = ref(false);
// True only when these docs are hosted inside the app's iframe (same check as
// Layout.vue). Converting a program posts to the parent app and needs the user's
// own program, so it only makes sense when there is one. Everything else on this
// page - including all the porting guidance - renders for a standalone visit too.
const embedded = ref(false);
const copied = ref(false);
let copiedTimer: ReturnType<typeof setTimeout> | undefined;

function optionFor(id: string): DialectOption | undefined {
  return props.dialects.find((d) => d.id === id);
}

/**
 * A field's choice, from the picker. The two fields are one component so that
 * opening one closes the other; which of them changed comes back here.
 *
 * `syncUrl` runs exactly where the `<select>`'s `@change` used to call it, so
 * `?from=`/`?to=` keep their values and every link already shared still
 * resolves to the comparison it named.
 */
function choose(field: 'from' | 'to', id: string) {
  if (field === 'from') from.value = id;
  else to.value = id;
  syncUrl();
}

const source = computed(() => optionFor(from.value));
const target = computed(() => optionFor(to.value));
const sameSelection = computed(() => from.value === to.value);

/**
 * The chosen side's rows, narrowed to the machine it names. A page's rows are
 * the union of what its machines have, so without this a port to a CPC 464 is
 * offered BASIC 1.1 commands and a C64 port is asked to deal with PET-only disk
 * commands.
 */
const sourceTable = computed(() => {
  const s = source.value;
  return s ? tableForMachine(s.reference, s.id) : undefined;
});
const targetTable = computed(() => {
  const t = target.value;
  return t ? tableForMachine(t.reference, t.id) : undefined;
});

const fullKeywordDiff = computed(() => {
  const s = source.value;
  const t = target.value;
  if (!s || !t || !sourceTable.value || !targetTable.value) return null;
  // `from`/`to` stay *page* slugs: the cross-dialect spelling data
  // (equivalences, false friends, pair notes) is a property of the BASIC, which
  // every machine on a page shares.
  return diffKeywords(sourceTable.value, targetTable.value, {
    from: s.page,
    to: t.page,
    equivalences: keywordEquivalences,
  });
});

// The prose guidance for the chosen pair, gathered in one place: what to watch
// for on the target machine, notes specific to this direction, the same-name-
// different-meaning traps (which nothing else on the page can surface, since
// they match on name, kind and usually syntax), and the per-command "do this
// instead" advice. The hardware address facts interpolate both sides as rows of
// the fact table instead (see factRows), not as prose.
const guidance = computed(() =>
  composeGuidance({
    from: source.value?.page ?? from.value,
    to: target.value?.page ?? to.value,
    targetFacts: target.value?.facts,
    pairNotes: pairPortingNotes,
    falseFriends,
    domainGuidance,
  }),
);

const sourceEscapes = computed(() => {
  const s = source.value;
  return s?.escapes ? escapeTableForMachine(s.escapes, s.id) : undefined;
});
const targetEscapes = computed(() => {
  const t = target.value;
  return t?.escapes ? escapeTableForMachine(t.escapes, t.id) : undefined;
});

const fullEscapeDiff = computed(() => {
  if (!sourceEscapes.value || !targetEscapes.value) return null;
  return diffEscapes(sourceEscapes.value, targetEscapes.value);
});

/*
 * ---- Narrowing to the open program -------------------------------------
 *
 * Inside the IDE the reader's own program is at hand, and a dissimilar pair
 * reports dozens of commands across thirteen capability domains plus a whole
 * escape table - a small fraction of which the program is subject to. The guide
 * asks the app what the program uses and narrows the differences it reports to
 * that, saying always how much it recognised and how much it is holding back.
 *
 * A handshake rather than a one-way push: the docs frame is client-routed and
 * long-lived, so a push sent when the frame loaded would have gone to a page
 * that did not exist yet. The reply is only sent in answer to a request, so a
 * drawer sitting on a reference page costs nothing.
 */
const vocabulary = ref<ProgramVocabulary | null>(null);
const vocabularyStatus = ref<'ready' | 'empty' | 'unreadable' | null>(null);
/** Whether `?from=` named the source machine; a named link always wins. */
const fromNamedByUrl = ref(false);
/** So the program's own machine is selected once, not on every re-push. */
const appliedProgramMachine = ref(false);

// Phrased as a "show", like every other control on this page: turning it on
// reveals the differences the program does not use. Off by default, so a
// comparison opened with a program open opens narrowed.
const showEveryDifference = ref(false);

const notice = computed(() =>
  noticeState({
    embedded: embedded.value,
    vocabulary: vocabulary.value,
    status: vocabularyStatus.value,
    sourceDialectId: from.value,
    showAll: showEveryDifference.value,
  }),
);

/** The vocabulary to filter by, or null when nothing is being narrowed. */
const narrowingBy = computed<ProgramVocabulary | null>(() =>
  notice.value.narrowed ? vocabulary.value : null,
);

// The narrowing applies to what the diff *returned*, never to the tables handed
// to it - see `diffForProgram`. Everything downstream reads these, so the page
// is written once and the narrowing is a property of the diff it reads.
const keywordDiff = computed(() => {
  const diff = fullKeywordDiff.value;
  const v = narrowingBy.value;
  return diff && v ? diffForProgram(diff, v) : diff;
});
const escapeDiff = computed(() => {
  const diff = fullEscapeDiff.value;
  const v = narrowingBy.value;
  return diff && v ? escapeDiffForProgram(diff, v) : diff;
});
const visibleFalseFriends = computed(() => {
  const all = guidance.value.falseFriends;
  const v = narrowingBy.value;
  return v ? falseFriendsForProgram(all, v) : all;
});

/**
 * The characters this port has to replace.
 *
 * Unlike the diff buckets, the unnarrowed answer is the target's whole
 * shortfall rather than a comparison: a character is not "lost in the port", it
 * is simply not on the machine, so a reader with no program open is told what
 * the target cannot represent at all.
 */
const charactersToReplace = computed<string[]>(() => {
  const t = target.value?.facts;
  if (!t) return [];
  const v = narrowingBy.value;
  return v ? unsupportedCharactersForProgram(t, v) : t.unsupportedCharacters;
});

/**
 * How this program's statement layout has to change, or null.
 *
 * Only ever narrowed: it is a statement about the program's own lines, so
 * without one there is nothing to say that the "Statements per line" fact row
 * does not already say better.
 */
const statementLayout = computed(() => {
  const s = source.value?.facts;
  const t = target.value?.facts;
  const v = narrowingBy.value;
  if (!s || !t || !v) return null;
  return statementLayoutForProgram(s, t, v);
});

/**
 * How many differences the narrowing is holding back. Stating this is what keeps
 * the narrowing honest: a difference the analyser failed to recognise is never
 * silently lost, because the count reveals it and the control reaches it.
 *
 * Only the narrowed buckets are counted - what the target adds is governed by
 * its own control, and the fact table and prose guidance are never narrowed.
 */
const heldBack = computed(() => {
  const full = fullKeywordDiff.value;
  const shown = keywordDiff.value;
  if (!full || !shown || !narrowingBy.value) return 0;
  return (
    full.mustReplace.length -
    shown.mustReplace.length +
    (full.renamed.length - shown.renamed.length) +
    (full.behaviourChanged.length - shown.behaviourChanged.length) +
    (guidance.value.falseFriends.length - visibleFalseFriends.value.length) +
    ((fullEscapeDiff.value?.mustReplace.length ?? 0) -
      (escapeDiff.value?.mustReplace.length ?? 0)) +
    ((fullEscapeDiff.value?.behaviourChanged.length ?? 0) -
      (escapeDiff.value?.behaviourChanged.length ?? 0)) +
    ((target.value?.facts.unsupportedCharacters.length ?? 0) -
      charactersToReplace.value.length)
  );
});

// Some cmp-list's run to dozens of rows for dissimilar pairs (e.g. ZX81 →
// BBC). Cap each at TRUNCATE_LIMIT and let the reader reveal the rest -
// section headings still count the full array, only the rendered rows are
// capped. `resetKey` re-collapses every list when the compared pair changes.
const TRUNCATE_LIMIT = 10;

function useTruncatedList<T>(
  getList: () => T[],
  resetKey: ComputedRef<string>,
) {
  const list = computed(getList);
  const expanded = ref(false);
  watch(resetKey, () => {
    expanded.value = false;
  });
  return reactive({
    visible: computed(() =>
      expanded.value ? list.value : list.value.slice(0, TRUNCATE_LIMIT),
    ),
    hasMore: computed(() => list.value.length > TRUNCATE_LIMIT),
    remaining: computed(() => list.value.length - TRUNCATE_LIMIT),
    expanded,
    expand: () => {
      expanded.value = true;
    },
  });
}

// Toggling the narrowing changes what every truncated list holds, so it belongs
// in the reset key beside the pair: a list expanded over the narrowed rows would
// otherwise stay expanded over the full set.
const pairKey = computed(
  () => `${from.value}:${to.value}:${narrowingBy.value ? 'narrowed' : 'full'}`,
);

const falseFriendsList = useTruncatedList(
  () => visibleFalseFriends.value,
  pairKey,
);
// The renames have no truncated list of their own: they are 1-4 commands for
// every pair here, named in one run like the parenthesis rule below.

// "The argument goes without parentheses" is one rule of the target language,
// not fifteen facts about fifteen functions: on Commodore → Spectrum exactly
// that difference accounts for half the changed keywords. Those are named in a
// single run, like a capability group, and only the changes that differ keyword
// by keyword get a row.
const parensChanged = computed<KeywordChange[]>(() =>
  (keywordDiff.value?.behaviourChanged ?? []).filter(
    (c) => c.change === 'parens',
  ),
);
const detailedChanges = computed<KeywordChange[]>(() =>
  (keywordDiff.value?.behaviourChanged ?? []).filter(
    (c) => c.change !== 'parens',
  ),
);
const behaviourChangedList = useTruncatedList(
  () => detailedChanges.value,
  pairKey,
);
// Capped like the other row-per-entry lists rather than named in a run: each
// entry's whole point is the two byte forms side by side, so it cannot be
// compressed to a spelling the way the codes to replace are. The ZX80 → ZX81
// pair produces twenty-one of them.
const escapeRecheckedList = useTruncatedList(
  () => escapeRechecked.value,
  pairKey,
);

const changedCount = computed(
  () => keywordDiff.value?.behaviourChanged.length ?? 0,
);

/** What changed about a keyword, for the row's own label. */
const CHANGE_LABEL: Record<KeywordChange['change'], string> = {
  kind: 'Different kind of keyword',
  parens: 'Parentheses differ',
  arguments: 'Different arguments',
};

/**
 * "1 command" / "3 commands", so the counts read as sentences rather than as
 * "1 command(s)". `plural` is for the words a trailing "s" gets wrong.
 */
function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** "a", "a and b", "a, b and c". */
function listOf(parts: string[]): string {
  if (parts.length < 2) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

// Grouped by what the codes do, in each table's own category order - the same
// treatment the commands to replace get, and for the same reason: the reader
// acts per category, and an alphabetical cap buries the colour and cursor codes
// a screen layout depends on under the block-graphics keycaps.
const escReplaceSections = computed<EscapeSection[]>(() => {
  const s = source.value;
  return escapeDiff.value && s?.escapes
    ? escapeSections(escapeDiff.value.mustReplace, s.escapes)
    : [];
});
// The codes the target adds and the source never used are not work the port has
// to do, so they are a count and a pointer rather than a second grouped column -
// the same treatment the capabilities the target adds already get.
const escapeAdded = computed(
  () => escapeDiff.value?.newlyAvailable.length ?? 0,
);
const escapeAddedCategories = computed(() => {
  const t = target.value;
  return escapeDiff.value && t?.escapes
    ? escapeSections(escapeDiff.value.newlyAvailable, t.escapes).length
    : 0;
});
// The codes both machines spell alike and store differently. A row each rather
// than a grouped run: the whole finding is the two byte forms side by side, and
// there are never many - this is the one difference in the comparison a reader
// cannot see by looking at their own program, so it earns the space.
const escapeRechecked = computed(
  () => escapeDiff.value?.behaviourChanged ?? [],
);

// One account per capability: the commands the port loses here, what to do
// instead, and what the target adds here. Grouped rather than capped - a group
// names its commands in one run instead of giving each a row, so 41 lost
// graphics commands are a wrapped line and nothing has to be hidden.
// Capabilities the target has no equivalent of at all lead, because "you lose
// sound entirely" is the headline, not entry 94 of an alphabetical list;
// capabilities the port only gains follow, being news rather than work.
const capabilities = computed<CapabilitySection[]>(() => {
  const diff = keywordDiff.value;
  const t = target.value;
  if (!diff || !t) return [];
  return capabilitySections(
    diff.mustReplace,
    diff.newlyAvailable,
    // Narrowed, so "the target has no keyword in this domain at all" is judged
    // on what the chosen machine has rather than what its family has.
    targetTable.value ?? t.reference,
    DOMAIN_ORDER,
    domainGuidance,
    // Page-keyed: domain guidance is written per BASIC, not per machine.
    t.page,
  );
});

/** How many capabilities the port loses commands from, for the summary. */
const losingCount = computed(
  () => capabilities.value.filter((s) => s.entries.length).length,
);
/** How many it only gains in - the "N new capability areas" of the summary. */
const gainingCount = computed(
  () => capabilities.value.filter((s) => !s.entries.length).length,
);

// A port is a translation, so what the target adds and the program never used
// is the one part of the comparison that is news rather than work. It is
// filtered out by default and a tick away, in both the sections that report it:
// the capabilities with nothing to replace, and the control codes the target
// adds. What the target offers *in a capability the port loses commands from*
// is not filtered - that is the "do this instead" the reader came for.
//
// Phrased as a "show", like every other checkbox here: a page mixing "show X"
// with "hide Y" makes the reader work out which way each tick points before
// ticking it. Off by default, so the additions still start hidden.
const showAdditions = ref(false);

const visibleCapabilities = computed<CapabilitySection[]>(() =>
  showAdditions.value
    ? capabilities.value
    : capabilities.value.filter((s) => s.entries.length),
);

/** The authored (target, capability) advice for a group, if any. */
function domainAdvice(section: CapabilitySection): DomainGuidance | undefined {
  return section.domain
    ? guidance.value.domains.get(section.domain)
    : undefined;
}

/**
 * The few commands in a group that carry a "do this instead" note. Per-command
 * advice still sits with its command: with no row to hang off, it renders as a
 * short exceptions run beneath the group's names, under the group's own advice.
 */
function substitutionsIn(
  section: CapabilitySection,
): { name: string; note: string }[] {
  const notes = guidance.value.substitutions;
  return section.entries.flatMap((e) => {
    const note = notes.get(e.name);
    return note ? [{ name: e.name, note }] : [];
  });
}

/** The trailing bucket is unreachable while every BASIC row carries a domain. */
function domainLabel(section: CapabilitySection): string {
  return section.domain ? DOMAIN_META[section.domain].label : 'Other';
}
function domainPaths(section: CapabilitySection): string {
  return section.domain ? DOMAIN_META[section.domain].paths : '';
}

/** One row of the language & hardware comparison. */
interface FactRow {
  label: string;
  fromText: string;
  toText: string;
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
 * The rows in the order a porter meets the work, most consequential first.
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
 * The memory facts close it as one run, addresses last: how memory is written
 * and how addresses are spelled, then the two addresses themselves. They are
 * the only rows that matter solely to a program that pokes at hardware, and
 * they were previously scattered - screen base between the screen and the free
 * RAM, program start after it, and the notation five rows further down.
 */
const factRows = computed<FactRow[]>(() => {
  const s = source.value?.facts;
  const t = target.value?.facts;
  if (!s || !t) return [];
  const rows: [string, (f: PortingFacts) => string][] = [
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
    ['Screen base', (f) => f.screenBase ?? 'No dedicated screen RAM'],
    ['Program start', (f) => f.programStart ?? '—'],
  ];
  return rows.map(([label, get]) => {
    const fromText = get(s);
    const toText = get(t);
    return { label, fromText, toText, changed: fromText !== toText };
  });
});

const changedFactCount = computed(
  () => factRows.value.filter((r) => r.changed).length,
);
const visibleFactRows = computed(() =>
  showUnchanged.value
    ? factRows.value
    : factRows.value.filter((r) => r.changed),
);

/**
 * The pair in one sentence, naming only what this port actually involves - a
 * clause reporting "0 commands to rename" beside a page with no rename section
 * is a form to decode rather than a summary to read.
 *
 * Narrowed, the same counts are about the program rather than about the pair,
 * so the sentence says so outright: "3 commands in your program to rewrite"
 * reads very differently from "3 commands to rewrite", and a reader who did not
 * notice the notice would otherwise take the smaller number for the whole port.
 * The language and hardware clause is untouched either way - those rules hold
 * for any program whatever commands it uses.
 */
const summary = computed(() => {
  const t = target.value;
  const diff = keywordDiff.value;
  if (!t || !diff) return '';
  const mine = narrowingBy.value ? ' in your program' : '';
  const work: string[] = [];
  if (diff.mustReplace.length)
    work.push(
      `${count(diff.mustReplace.length, 'command')}${mine} to rewrite across ` +
        `${count(losingCount.value, 'capability area')}`,
    );
  if (diff.renamed.length)
    work.push(`${count(diff.renamed.length, 'command')}${mine} to rename`);
  if (changedCount.value)
    work.push(
      `${count(changedCount.value, 'command')}${mine} whose usage differs`,
    );

  const facts = changedFactCount.value;
  const sentences = work.length ? [`${listOf(work)}.`] : [];
  if (!work.length && narrowingBy.value)
    sentences.push('Nothing in your program has to be rewritten.');
  const rest = [
    `${count(facts, 'language or hardware rule')} ${
      facts === 1 ? 'differs' : 'differ'
    }`,
  ];
  if (gainingCount.value)
    rest.push(`${t.name} adds ${count(gainingCount.value, 'capability area')}`);
  sentences.push(`${listOf(rest)}.`);
  return sentences.join(' ');
});

/**
 * The notice under the summary, in words. The page must always say where it
 * stands with respect to the open program - narrowed, or not narrowed and what
 * would narrow it - so every state {@link noticeState} can return has a sentence
 * here and the template renders whichever one it resolved to.
 *
 * No error count for the unreadable case: the status bar beside the editor
 * already counts every finding, and this one is about the few that stop the
 * program being read at all. Two different numbers for "errors" would be worse
 * than one.
 */
const noticeText = computed(() => {
  const s = source.value;
  switch (notice.value.kind) {
    case 'standalone':
      return 'Open your program in the Basically IDE to narrow this comparison to the commands and control codes it actually uses.';
    case 'no-program':
      return 'Nothing is open in the editor. Write or load a program to narrow this comparison to the commands and control codes it uses.';
    case 'unreadable':
      return `Your program cannot be read as ${
        s?.name ?? 'this machine'
      } BASIC yet, so every difference is shown. Fix the errors flagged in the editor and it will narrow to what the program uses.`;
    case 'reading':
      return `Reading your program as ${s?.name ?? 'this machine'} BASIC…`;
    case 'narrowed':
      return recognisedText.value;
  }
  return '';
});

/** How much of the program the comparison recognised, for the narrowed notice. */
const recognisedText = computed(() => {
  const v = vocabulary.value;
  if (!v) return '';
  const parts = [count(v.keywords.length, 'command')];
  if (v.escapeCodes.length)
    parts.push(count(v.escapeCodes.length, 'control code'));
  return `Narrowed to your program: ${listOf(parts)} recognised.`;
});

/** What the narrowing is holding back, so the control can be found. */
const heldBackText = computed(() =>
  heldBack.value
    ? `${count(heldBack.value, 'other difference')} for this pair ${
        heldBack.value === 1 ? 'is' : 'are'
      } not shown.`
    : '',
);

/** One entry of the colour key: a swatch style and what that colour means. */
interface LegendItem {
  key: string;
  /** Modifier class carrying the same colour as the thing it explains. */
  className: string;
  label: string;
}

/**
 * What the capability-group colours on this page mean, for the colours this
 * pair actually uses. Nothing else says why one group is tinted red and the
 * next has a green edge, and a key listing colours the pair does not use would
 * be its own small puzzle - so each entry is conditioned on the same thing the
 * template renders it from. The highlighted fact rows are not keyed: the table
 * they sit in has a "show unchanged rows" tick right above it, which says what
 * the highlight means better than a swatch does.
 */
const legend = computed<LegendItem[]>(() => {
  const t = target.value;
  if (!t) return [];
  const groups = visibleCapabilities.value;
  const losing = (
    s: CapabilitySection,
    support: CapabilitySection['support'],
  ) => s.entries.length > 0 && s.support === support;
  const items: LegendItem[] = [];
  if (groups.some((s) => losing(s, 'none')))
    items.push({
      key: 'none',
      className: 'cmp-key-none',
      label: `Nothing like it in ${t.name}`,
    });
  if (groups.some((s) => losing(s, 'partial')))
    items.push({
      key: 'partial',
      className: 'cmp-key-partial',
      label: `Only partly covered in ${t.name}`,
    });
  if (groups.some((s) => losing(s, 'full')))
    items.push({
      key: 'full',
      className: 'cmp-key-full',
      label: `Covered in ${t.name} under other names`,
    });
  if (groups.some((s) => !s.entries.length))
    items.push({
      key: 'gain',
      className: 'cmp-key-gain',
      label: `Nothing to replace — ${t.name} only adds here`,
    });
  return items;
});

/**
 * The sections this pair actually renders, in page order: the "on this page"
 * row, and the ids its links and the headings share. Built from the same
 * conditions the template guards each section with, so a section is listed
 * exactly when it is shown. The headings are rendered by this component rather
 * than by markdown, so VitePress's own outline cannot see them.
 */
const pageSections = computed<{ id: string; label: string }[]>(() => {
  if (sameSelection.value || !keywordDiff.value) return [];
  const g = guidance.value;
  const entries: [boolean, string, string][] = [
    [
      visibleFactRows.value.length > 0,
      'language-hardware',
      'Language & hardware',
    ],
    [
      g.pairNotes.length + g.targetNotes.length > 0,
      'guidance',
      'Before you start',
    ],
    [
      visibleFalseFriends.value.length > 0,
      'false-friends',
      'Same word, different meaning',
    ],
    [capabilities.value.length > 0, 'capabilities', 'What changes'],
    [
      keywordDiff.value.renamed.length + changedCount.value > 0,
      'different-form',
      'Same command, different form',
    ],
    [
      escReplaceSections.value.length +
        escapeAdded.value +
        escapeRechecked.value.length >
        0,
      'escape-codes',
      'Control & escape codes',
    ],
    [
      charactersToReplace.value.length > 0,
      'characters',
      'Characters to replace',
    ],
    [statementLayout.value !== null, 'statement-layout', 'Statement layout'],
  ];
  return entries
    .filter(([shown]) => shown)
    .map(([, id, label]) => ({ id, label }));
});

/** Reference sub-pages for a dialect page slug, relative to /reference/compare. */
function refLinks(id: string) {
  return {
    reference: `./${id}`,
    hardware: `./${id}/hardware`,
    escapes: `./${id}/escapes`,
    formats: `./${id}/formats`,
  };
}

function swap() {
  const f = from.value;
  from.value = to.value;
  to.value = f;
  syncUrl();
}

function syncUrl() {
  if (typeof window === 'undefined') return;
  const { origin, pathname } = window.location;
  const url = `${origin}${pathname}?from=${encodeURIComponent(
    from.value,
  )}&to=${encodeURIComponent(to.value)}`;
  history.replaceState(history.state, '', url);
}

async function copyLink() {
  syncUrl();
  try {
    await navigator.clipboard.writeText(window.location.href);
  } catch {
    // Clipboard blocked; the address bar already reflects the link.
  }
  copied.value = true;
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => (copied.value = false), 1500);
}

onMounted(() => {
  if (window.parent !== window.self) embedded.value = true;
});

// `?from=`/`?to=` select the pair. Unlike the tables' `?q=`, a link without them
// leaves the current selection alone - the selects have meaningful defaults the
// reader may have already changed.
useDeepLinkParams(({ from: f, to: t }) => {
  if (f && optionFor(f)) {
    from.value = f;
    // A link that names the machines must resolve to the comparison it names,
    // for everyone: the program's own machine is only the *default* source.
    fromNamedByUrl.value = true;
  }
  if (t && optionFor(t)) to.value = t;
});

/**
 * Ask the app to carry the port out.
 *
 * Both ends travel, not just the target: the app assembles the request from the
 * same comparison data this page renders, and it cannot work out which machine
 * the program is being ported *from* on its own - the guide is normally reached
 * by switching to a machine that will not run the program and keeping it, so by
 * then the IDE's selected dialect is the target. `fromId` is undefined where the
 * source selection does not resolve, which the app reads as "no source machine"
 * and answers by sending its plain request rather than a wrong report.
 */
function convertWithAi() {
  const t = target.value;
  if (!t) return;
  window.parent.postMessage(
    {
      type: CONVERT_MESSAGE,
      toId: t.id,
      toLabel: t.name,
      fromId: source.value?.id,
    },
    window.location.origin,
  );
}

/**
 * Ask the app what the open program uses, read as the machine being ported
 * *from*. Sent on mount and again whenever that machine changes - a vocabulary
 * describes one BASIC, so pointing the comparison somewhere else re-reads the
 * program in that language rather than abandoning the narrowing.
 */
function requestVocabulary() {
  if (!embedded.value) return;
  window.parent.postMessage(
    { type: VOCABULARY_REQUEST, from: from.value },
    window.location.origin,
  );
}

function onVocabularyMessage(e: MessageEvent) {
  if (e.origin !== window.location.origin) return;
  const data = e.data;
  if (!data || typeof data !== 'object') return;
  if (data.type !== VOCABULARY_MESSAGE) return;
  vocabularyStatus.value =
    data.status === 'ready' || data.status === 'unreadable'
      ? data.status
      : 'empty';
  // Every field defaults to empty rather than being required: the app and this
  // guide are separately built bundles with their own service workers, so a
  // cached older app answering without the newer fields is a real case. An empty
  // field narrows nothing, which degrades to the guidance this page gave before
  // that field existed.
  vocabulary.value = {
    dialectId: String(data.dialectId ?? ''),
    keywords: Array.isArray(data.keywords) ? data.keywords : [],
    escapeCodes: Array.isArray(data.escapeCodes) ? data.escapeCodes : [],
    characters: Array.isArray(data.characters) ? data.characters : [],
    multiStatementLines: Array.isArray(data.multiStatementLines)
      ? data.multiStatementLines
      : [],
  };
  // On the first answer, open on the machine the program is written for: it is
  // the one selection under which the narrowing means anything. A link that
  // named the source machine still wins.
  if (
    !appliedProgramMachine.value &&
    !fromNamedByUrl.value &&
    optionFor(vocabulary.value.dialectId)
  ) {
    appliedProgramMachine.value = true;
    if (from.value !== vocabulary.value.dialectId) {
      from.value = vocabulary.value.dialectId;
      syncUrl();
      return; // the `from` watcher below re-asks in that machine's language
    }
  }
  appliedProgramMachine.value = true;
}

onMounted(() => {
  window.addEventListener('message', onVocabularyMessage);
  requestVocabulary();
});
onBeforeUnmount(() =>
  window.removeEventListener('message', onVocabularyMessage),
);
watch(from, requestVocabulary);
</script>

<template>
  <div class="cmp">
    <!--
      Anything that does not change with the pair - the page intro, and the
      link to the porting primer - stays in the markdown above this component,
      so every section below runs pair-specific from first to last.
    -->
    <div class="cmp-panel">
      <div class="cmp-controls">
        <MachinePicker
          :machines="props.dialects"
          :from="from"
          :to="to"
          @choose="choose"
        >
          <button
            type="button"
            class="cmp-swap"
            title="Swap source and target"
            aria-label="Swap source and target"
            @click="swap"
          >
            ⇄
          </button>
        </MachinePicker>
        <button
          type="button"
          class="cmp-copy"
          :class="{ copied }"
          title="Copy a link to this comparison"
          @click="copyLink"
        >
          {{ copied ? 'Link copied' : 'Copy link' }}
        </button>
        <button
          v-if="embedded && !sameSelection"
          type="button"
          class="cmp-ai-button"
          @click="convertWithAi"
        >
          Convert with AI
        </button>
      </div>

      <p v-if="sameSelection" class="cmp-note">
        Pick two different machines to see what changes.
      </p>

      <template v-else-if="source && target && keywordDiff">
        <p class="cmp-summary">
          <strong>{{ source.name }} → {{ target.name }}:</strong>
          {{ summary }}
        </p>
        <!--
          Where the comparison stands with respect to the open program, in one
          block under the summary: narrowed and by how much, or not narrowed and
          what would narrow it. It is one block rather than a line per narrowed
          section because the narrowing governs five of them, and a reader who
          has not noticed the control has to be able to find it from any of them.
        -->
        <p class="cmp-note cmp-program-note">
          {{ noticeText }}
          <span v-if="notice.narrowed && heldBackText" class="cmp-held-back">
            {{ heldBackText }}
          </span>
        </p>
        <label v-if="notice.offerControl" class="cmp-toggle">
          <input v-model="showEveryDifference" type="checkbox" />
          Show every difference, not just the ones your program uses
        </label>
        <!--
          The component renders every heading below, so VitePress's own outline
          (built from the markdown) cannot see them and none of them can be
          linked to. This row is the page's contents, listing exactly the
          sections this pair renders.
        -->
        <nav v-if="pageSections.length" class="cmp-jump" aria-label="Sections">
          <a v-for="s in pageSections" :key="s.id" :href="`#${s.id}`">{{
            s.label
          }}</a>
        </nav>
        <p class="cmp-links">
          Full reference:
          <a :href="refLinks(source.page).reference">{{ source.name }}</a>
          (<a :href="refLinks(source.page).hardware">hardware</a>,
          <a :href="refLinks(source.page).escapes">escape codes</a>,
          <a :href="refLinks(source.page).formats">file formats</a>) ·
          <a :href="refLinks(target.page).reference">{{ target.name }}</a>
          (<a :href="refLinks(target.page).hardware">hardware</a>,
          <a :href="refLinks(target.page).escapes">escape codes</a>,
          <a :href="refLinks(target.page).formats">file formats</a>)
        </p>
      </template>
    </div>

    <template v-if="!sameSelection && source && target && keywordDiff">
      <!--
        Language & hardware first: the differences that decide how much of the
        program has to change at all, right under the picker so they move as
        the from/to inputs do.
      -->
      <section
        v-if="visibleFactRows.length || factRows.length"
        id="language-hardware"
        class="cmp-section"
      >
        <h2>Language &amp; hardware</h2>
        <label class="cmp-toggle">
          <input v-model="showUnchanged" type="checkbox" />
          Show unchanged rows
        </label>
        <table class="cmp-facts">
          <thead>
            <tr>
              <th></th>
              <th>{{ source.name }}</th>
              <th>{{ target.name }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in visibleFactRows"
              :key="row.label"
              :class="{ 'cmp-changed': row.changed }"
            >
              <th scope="row">{{ row.label }}</th>
              <td>{{ row.fromText }}</td>
              <td>{{ row.toText }}</td>
            </tr>
            <tr v-if="visibleFactRows.length === 0">
              <td colspan="3" class="cmp-empty">
                No language or hardware differences.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!--
        One list of prose guidance, not two: the notes for this direction (the
        few pairs close enough, or trap-laden enough, to warrant them) lead,
        then what to watch for on the target whatever you arrive from.
      -->
      <section
        v-if="guidance.pairNotes.length || guidance.targetNotes.length"
        id="guidance"
        class="cmp-section cmp-guidance"
      >
        <h2>Before you start: {{ source.name }} → {{ target.name }}</h2>
        <ul class="cmp-notes">
          <li
            v-for="note in guidance.pairNotes"
            :key="note"
            class="cmp-pair-note"
          >
            {{ note }}
          </li>
          <li v-for="note in guidance.targetNotes" :key="note">
            {{ note }}
          </li>
        </ul>
      </section>

      <!--
        The colour key, once the reader has been told what to watch for and
        immediately above the graded sections that use the colours: one row, so
        it costs a glance rather than a paragraph, and only the colours this
        pair puts on the page.
      -->
      <div v-if="legend.length" class="cmp-legend">
        <span class="cmp-legend-title">Colour key</span>
        <span v-for="item in legend" :key="item.key" class="cmp-legend-item">
          <span
            class="cmp-legend-swatch"
            :class="item.className"
            aria-hidden="true"
          />
          {{ item.label }}
        </span>
      </div>

      <!--
        Before the lists of what to change: these are the only differences that
        fail silently. The command exists on both machines, so nothing else on
        this page flags it, and the program runs and quietly computes something
        else.
      -->
      <section
        v-if="visibleFalseFriends.length"
        id="false-friends"
        class="cmp-section cmp-traps"
      >
        <h2>Same word, different meaning ({{ visibleFalseFriends.length }})</h2>
        <p class="cmp-hint">
          These exist on both machines, so they raise no error — they just do
          something else.
        </p>
        <ul class="cmp-list">
          <li v-for="t in falseFriendsList.visible" :key="t.keyword">
            <code>{{ t.keyword }}</code>
            <span class="cmp-change-detail">
              <span class="cmp-from">{{ source.name }}: {{ t.from }}</span>
              <span class="cmp-arrow">→</span>
              <span class="cmp-to">{{ target.name }}: {{ t.to }}</span>
            </span>
          </li>
          <li
            v-if="falseFriendsList.hasMore && !falseFriendsList.expanded"
            class="cmp-more"
          >
            <button
              type="button"
              class="cmp-expand"
              @click="falseFriendsList.expand()"
            >
              Show {{ falseFriendsList.remaining }} more…
            </button>
          </li>
        </ul>
      </section>

      <!--
        One account per capability: what the port loses here, what to do
        instead, and what the target adds here. These were two sections until
        the measurements showed over half of all capability mentions were being
        made twice, from the two halves of the same authored guidance cell.
        Grouped, not capped: a group names its commands in one run, so every
        lost command is shown and a capability the port does not touch is simply
        absent.
      -->
      <section v-if="capabilities.length" id="capabilities" class="cmp-section">
        <h2>What changes</h2>
        <p class="cmp-hint">
          {{ count(keywordDiff.mustReplace.length, 'command') }} to rewrite or
          remove, grouped by what they do, with what {{ target.name }} offers in
          their place. The capabilities {{ target.name }} has no equivalent of
          at all come first.
        </p>
        <label v-if="gainingCount" class="cmp-toggle">
          <input v-model="showAdditions" type="checkbox" />
          Show what {{ target.name }} adds that the program has not used
        </label>
        <div
          v-for="s in visibleCapabilities"
          :key="s.domain ?? 'other'"
          class="cmp-group"
          :class="{
            'cmp-group-absent': s.entries.length && s.support === 'none',
            'cmp-group-partial': s.entries.length && s.support === 'partial',
            'cmp-group-covered': s.entries.length && s.support === 'full',
            'cmp-group-gain-only': !s.entries.length,
          }"
        >
          <h3 class="cmp-group-head">
            <span v-if="s.domain" class="cmp-icon">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                role="img"
                :aria-label="domainLabel(s)"
                v-html="domainPaths(s)"
              />
            </span>
            {{ domainLabel(s) }}
            <span v-if="s.entries.length" class="cmp-group-count">{{
              s.entries.length
            }}</span>
            <span
              v-if="s.entries.length && s.support === 'none'"
              class="cmp-group-none"
            >
              nothing like it in {{ target.name }}
            </span>
            <span
              v-else-if="s.entries.length && s.support === 'partial'"
              class="cmp-group-partial-badge"
            >
              only partly covered in {{ target.name }}
            </span>
            <span v-else-if="!s.entries.length" class="cmp-group-gain-badge">
              nothing to replace — {{ target.name }} adds
              {{ s.gained?.count }} here
            </span>
          </h3>
          <p v-if="s.entries.length" class="cmp-group-names">
            <span v-for="(e, i) in s.entries" :key="e.name" class="cmp-name">
              <code>{{ e.name }}</code
              ><span v-if="e.tag" class="cmp-tag">{{ e.tag }}</span
              ><span v-if="i < s.entries.length - 1" class="cmp-sep">, </span>
            </span>
          </p>
          <div
            v-if="s.entries.length && domainAdvice(s)?.instead"
            class="cmp-group-advice"
          >
            <p class="cmp-group-instead-text">{{ domainAdvice(s)?.instead }}</p>
            <div v-if="domainAdvice(s)?.example" class="cmp-example">
              <p class="cmp-example-caption">
                {{ domainAdvice(s)?.example?.caption }}
              </p>
              <pre class="cmp-example-code"><code>{{
                domainAdvice(s)?.example?.code.join('\n')
              }}</code></pre>
            </div>
          </div>
          <ul v-if="substitutionsIn(s).length" class="cmp-group-instead">
            <li v-for="x in substitutionsIn(s)" :key="x.name">
              <code>{{ x.name }}</code> — {{ x.note }}
            </li>
          </ul>
          <!--
            What the target offers here, in the same account as what it costs.
            The count leads as its own sentence: run into the summary it read as
            though the summary listed the additions, which it does not - it
            describes the capability whole. `reachFor` names appear only where
            there is no list of lost commands above them to anchor the group, so
            no name is printed twice.
          -->
          <p v-if="s.gained" class="cmp-group-gain">
            <span v-if="s.entries.length" class="cmp-gain-lead"
              >{{ target.name }} adds {{ s.gained.count }} here.</span
            >
            {{ s.gained.summary }}
            <span
              v-if="!s.entries.length && s.gained.reachFor.length"
              class="cmp-reach-for"
            >
              e.g.
              <span v-for="(n, i) in s.gained.reachFor" :key="n">
                <code>{{ n }}</code
                ><span v-if="i < s.gained.reachFor.length - 1">, </span>
              </span>
            </span>
          </p>
        </div>
        <!-- Say what the filter is holding back, so it is discoverable. -->
        <p v-if="!showAdditions && gainingCount" class="cmp-empty">
          {{ count(gainingCount, 'capability area') }}
          {{ target.name }} only adds to
          {{ gainingCount === 1 ? 'is' : 'are' }} hidden.
        </p>
      </section>

      <!--
        From here down the page is reference rather than work. Renames and
        usage changes share a premise - the command is on both machines,
        written differently - so they share a section; a rename is its two
        spellings, not a row carrying a description the reference page gives.
      -->
      <section
        v-if="keywordDiff.renamed.length || changedCount"
        id="different-form"
        class="cmp-section"
      >
        <h2>Same command, different form</h2>
        <p class="cmp-hint">
          On both machines, but not written the same way — a search and replace
          for the first two, a look at each use for the rest.
        </p>
        <p v-if="keywordDiff.renamed.length" class="cmp-change-rule">
          {{ count(keywordDiff.renamed.length, 'command') }} spelled
          differently:
          <span
            v-for="(r, i) in keywordDiff.renamed"
            :key="r.from.name"
            class="cmp-name"
          >
            <code>{{ r.from.name }}</code> → <code>{{ r.to.name }}</code
            ><span v-if="i < keywordDiff.renamed.length - 1" class="cmp-sep"
              >,
            </span>
          </span>
        </p>
        <!--
          One rule of the target language, named once with the keywords it
          applies to, rather than repeated as a row each: on Commodore →
          Spectrum this alone would otherwise be fifteen rows saying the same
          thing.
        -->
        <p v-if="parensChanged.length" class="cmp-change-rule">
          {{ count(parensChanged.length, 'command') }} differing only in whether
          the argument is bracketed — write them as {{ target.name }} does:
          <span v-for="(c, i) in parensChanged" :key="c.name" class="cmp-name">
            <code>{{ c.name }}</code
            ><span v-if="i < parensChanged.length - 1" class="cmp-sep">, </span>
          </span>
        </p>
        <ul v-if="detailedChanges.length" class="cmp-list cmp-change">
          <li v-for="c in behaviourChangedList.visible" :key="c.name">
            <span class="cmp-change-head">
              <code>{{ c.name }}</code>
              <span class="cmp-change-what">{{ CHANGE_LABEL[c.change] }}</span>
            </span>
            <span class="cmp-change-detail">
              <span class="cmp-from"
                >{{ source.name }}: {{ c.from.kind }} ·
                <code>{{ c.from.syntax }}</code></span
              >
              <span class="cmp-arrow">→</span>
              <span class="cmp-to"
                >{{ target.name }}: {{ c.to.kind }} ·
                <code>{{ c.to.syntax }}</code></span
              >
            </span>
          </li>
          <li
            v-if="
              behaviourChangedList.hasMore && !behaviourChangedList.expanded
            "
            class="cmp-more"
          >
            <button
              type="button"
              class="cmp-expand"
              @click="behaviourChangedList.expand()"
            >
              Show {{ behaviourChangedList.remaining }} more…
            </button>
          </li>
        </ul>
      </section>

      <!--
        The codes to replace are grouped by what they do, in the source's own
        category order, and not capped: the same treatment the commands to
        replace get. An alphabetical cap buried the colour and cursor codes a
        screen layout depends on under the block-graphics keycaps. The codes the
        target adds and the program never used are a count and a pointer - not
        work the port has to do.
      -->
      <section
        v-if="
          escReplaceSections.length || escapeAdded || escapeRechecked.length
        "
        id="escape-codes"
        class="cmp-section"
      >
        <h2>
          Control &amp; escape codes ({{ escapeDiff?.mustReplace.length ?? 0 }}
          to replace)
        </h2>
        <p class="cmp-hint">
          Embedded colour and graphics control codes differ between the
          machines. Grouped by what they do; the
          <a :href="refLinks(source.page).escapes"
            >{{ source.name }} escape-code reference</a
          >
          gives every code's meaning.
        </p>
        <label v-if="escapeAdded" class="cmp-toggle">
          <input v-model="showAdditions" type="checkbox" />
          Show what {{ target.name }} adds that the program has not used
        </label>
        <div
          v-for="s in escReplaceSections"
          :key="s.category ?? 'other'"
          class="cmp-group cmp-group-esc"
        >
          <h3 class="cmp-group-head">
            {{ s.label }}
            <span class="cmp-group-count">{{ s.entries.length }}</span>
          </h3>
          <p class="cmp-group-names">
            <span v-for="(e, i) in s.entries" :key="e.escape" class="cmp-name">
              <code>{{ e.escape }}</code
              ><span v-if="i < s.entries.length - 1" class="cmp-sep">, </span>
            </span>
          </p>
        </div>
        <p v-if="!escReplaceSections.length" class="cmp-empty">
          No {{ source.name }} control code needs replacing.
        </p>
        <!--
          The codes that survive the port unchanged in the source and mean
          something else at the other end. Set apart from the groups above
          because the work is different in kind: nothing in the program's text
          changes, so there is nothing to search for - the reader has to be told.
        -->
        <div v-if="escapeRechecked.length" class="cmp-group cmp-group-esc">
          <h3 class="cmp-group-head">
            Same spelling, different meaning
            <span class="cmp-group-count">{{ escapeRechecked.length }}</span>
          </h3>
          <ul class="cmp-list">
            <li v-for="c in escapeRecheckedList.visible" :key="c.escape">
              <code>{{ c.escape }}</code> stores {{ c.from.bytes }} on
              {{ source.name }} and {{ c.to.bytes }} on {{ target.name }}.
            </li>
            <li
              v-if="
                escapeRecheckedList.hasMore && !escapeRecheckedList.expanded
              "
              class="cmp-more"
            >
              <button
                type="button"
                class="cmp-expand"
                @click="escapeRecheckedList.expand()"
              >
                Show {{ escapeRecheckedList.remaining }} more…
              </button>
            </li>
          </ul>
        </div>
        <p v-if="escapeAdded && showAdditions" class="cmp-esc-gain">
          {{ target.name }} adds {{ count(escapeAdded, 'code') }} across
          {{ count(escapeAddedCategories, 'category', 'categories') }} the
          program has not used —
          <a :href="refLinks(target.page).escapes"
            >see its escape-code reference</a
          >.
        </p>
      </section>

      <!--
        Characters, not control codes: a character the target has no glyph for
        is rejected when the program is read, wherever it sits - in a string, a
        REM or a variable name. Narrowed to the program's own text where there
        is one; the target's whole shortfall where there is not.
      -->
      <section
        v-if="charactersToReplace.length"
        id="characters"
        class="cmp-section"
      >
        <h2>Characters to replace ({{ charactersToReplace.length }})</h2>
        <p class="cmp-hint">
          {{ target.name }} has no glyph for
          {{
            narrowingBy
              ? 'these characters the program uses'
              : 'these characters'
          }}, so they cannot appear anywhere in the program — not in a string,
          and not in a comment.
        </p>
        <p class="cmp-group-names">
          <span v-for="(c, i) in charactersToReplace" :key="c" class="cmp-name">
            <code>{{ c }}</code
            ><span v-if="i < charactersToReplace.length - 1" class="cmp-sep"
              >,
            </span>
          </span>
        </p>
      </section>

      <!--
        Always narrowed: without a program this says nothing the "Statements per
        line" fact row does not already say, and with one it is the only place
        the reader learns which of their own lines the rule falls on.
      -->
      <section v-if="statementLayout" id="statement-layout" class="cmp-section">
        <h2>
          Statement layout ({{ count(statementLayout.lines.length, 'line') }})
        </h2>
        <p class="cmp-hint" v-if="statementLayout.kind === 'split'">
          {{ target.name }} takes one statement per line, so every
          <code>{{ statementLayout.from }}</code> becomes a new line. That
          renumbers everything after it — <strong>Renumber file</strong> fixes
          the line references.
        </p>
        <p class="cmp-hint" v-else>
          {{ target.name }} separates statements with
          <code>{{ statementLayout.to }}</code
          >, not <code>{{ statementLayout.from }}</code
          >. The lines keep their shape; only the separator changes.
        </p>
        <p class="cmp-group-names">
          Editor
          {{ statementLayout.lines.length === 1 ? 'line' : 'lines' }}
          <span
            v-for="(n, i) in statementLayout.lines"
            :key="n"
            class="cmp-name"
          >
            <code>{{ n }}</code
            ><span v-if="i < statementLayout.lines.length - 1" class="cmp-sep"
              >,
            </span>
          </span>
        </p>
      </section>
    </template>
  </div>
</template>

<style scoped>
/* The picker panel: grouped, bordered and set apart so the from/to controls
   read as the page's primary action, above the explanatory prose. */
.cmp-panel {
  margin: 2rem 0;
  padding: 1.1rem 1.25rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
}
.cmp-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem;
  margin: 0;
}
/* The two machine fields are rendered by MachinePicker, which styles them:
   a scoped rule here would not reach inside a child component anyway. */
.cmp-swap,
.cmp-copy {
  padding: 0.4rem 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  cursor: pointer;
  font-size: 0.9rem;
}
.cmp-copy.copied {
  color: var(--vp-c-green-1);
  border-color: var(--vp-c-green-1);
}
/* Narrow: a phone, or the IDE's docs drawer, which is an iframe and so has a
   viewport of its own. Left to wrap on their own the five controls break
   wherever they happen to run out of room - the swap button beside "Porting
   from", and "to" sharing a line with Copy link, which reads as two unrelated
   pairs rather than two machines and some actions. Each machine gets a line,
   and the buttons that act on the pair follow on a line below it. */
@media (max-width: 640px) {
  /* `:deep` because MachinePicker renders the fields; the *layout* of the row
     they sit in is this component's, which is why the rule lives here. */
  .cmp-controls :deep(.mp-field) {
    flex: 1 0 100%;
  }
  .cmp-swap,
  .cmp-copy,
  .cmp-ai-button {
    order: 1;
  }
}
/* Where the comparison stands with respect to the open program, directly under
   the summary whose counts it qualifies. */
.cmp-program-note {
  margin: 0.5rem 0 0.35rem;
}
.cmp-held-back {
  color: var(--vp-c-text-3, var(--vp-c-text-2));
}
/* Sits inside the panel under the controls, so a divider rather than its own
   box separates it from them. */
.cmp-summary {
  margin: 0.85rem 0 0;
  padding-top: 0.85rem;
  border-top: 1px solid var(--vp-c-divider);
}
/* Both sit in the panel under the summary: the page's contents, then the two
   dialects' full reference pages. */
.cmp-jump {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 0.6rem;
  margin: 0.6rem 0 0;
  font-size: 0.8rem;
}
.cmp-links {
  margin: 0.6rem 0 0;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}
.cmp-ai-button {
  padding: 0.4rem 0.7rem;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 6px;
  background: var(--vp-c-brand-1);
  color: #fff;
  cursor: pointer;
  font-size: 0.9rem;
}
/* The colour key: one horizontal run above the sections, wrapping on narrow
   screens rather than becoming a stacked list that outgrows what it explains. */
.cmp-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 1rem;
  margin: 1.25rem 0 0;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
}
.cmp-legend-title {
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.cmp-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
/* Each swatch carries the treatment it explains: a left bar for the capability
   groups, a filled block for the highlighted fact rows. */
.cmp-legend-swatch {
  width: 1.1rem;
  height: 0.9rem;
  border-radius: 2px;
  background: var(--vp-c-bg-soft);
}
.cmp-key-none {
  border-left: 3px solid var(--vp-c-red-1);
  background: var(--vp-c-red-soft);
}
.cmp-key-partial {
  border-left: 3px solid var(--vp-c-red-1);
}
.cmp-key-full {
  border-left: 3px solid var(--vp-c-yellow-1);
}
.cmp-key-gain {
  border-left: 3px solid var(--vp-c-green-1);
}
.cmp-section {
  margin-top: 2rem;
}
.cmp-section h2 {
  margin-bottom: 0.25rem;
}
.cmp-hint,
.cmp-note {
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
}
/* In the panel, under the controls. */
.cmp-note {
  margin: 0.85rem 0 0;
}
.cmp-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
  margin-bottom: 0.5rem;
}
.cmp-facts {
  display: table;
  width: 100%;
  border-collapse: collapse;
}
.cmp-facts th,
.cmp-facts td {
  text-align: left;
  vertical-align: top;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 0.9rem;
}
.cmp-facts tbody th {
  width: 12rem;
  color: var(--vp-c-text-2);
  font-weight: 600;
}
.cmp-facts .cmp-changed td {
  background: var(--vp-c-warning-soft, var(--vp-c-yellow-soft));
}
.cmp-list {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0;
}
.cmp-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem;
  padding: 0.35rem 0.5rem;
  border-left: 3px solid transparent;
  border-bottom: 1px solid var(--vp-c-divider);
}
.cmp-remove li {
  border-left-color: var(--vp-c-red-1);
}
.cmp-add li {
  border-left-color: var(--vp-c-green-1);
}
.cmp-change li {
  border-left-color: var(--vp-c-yellow-1);
  flex-direction: column;
  align-items: stretch;
}
.cmp-change-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem;
}
/* What changed, so the reader is told rather than left to compare two usage
   strings by eye. */
.cmp-change-what {
  padding: 0 0.35rem;
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 0.75rem;
}
/* One rule of the target language, stated once above the per-keyword rows. */
.cmp-change-rule {
  margin: 0.5rem 0 0;
  padding: 0.4rem 0.6rem;
  border-left: 3px solid var(--vp-c-yellow-1);
  background: var(--vp-c-bg-soft);
  font-size: 0.85rem;
  line-height: 1.9;
}
/* One capability's worth of lost commands: a heading and a run of names,
   rather than a row per command. Red left edge to match .cmp-remove, which
   this section no longer uses. Red is the "needs your attention" end of the
   scale: the groups whose commands the target cannot replace outright keep it,
   and the ones it does cover step down to amber. */
.cmp-group {
  margin: 0.75rem 0;
  padding: 0.5rem 0 0.5rem 0.7rem;
  border-left: 3px solid var(--vp-c-red-1);
}
/* The capabilities the target has no equivalent of - the ones that lead. */
.cmp-group.cmp-group-absent {
  background: var(--vp-c-red-soft);
}
/* Capabilities the target only partly covers - still work you have to think
   about, so they keep the red edge and are told apart by the badge. */
.cmp-group.cmp-group-partial {
  border-left-color: var(--vp-c-red-1);
}
/* Capabilities the target covers under other names - the least of the work
   here, so amber rather than red. */
.cmp-group.cmp-group-covered {
  border-left-color: var(--vp-c-yellow-1);
}
/* Capabilities the port loses nothing from - news, not work, so they read as
   an addition rather than a loss and sit after the groups that cost something. */
.cmp-group.cmp-group-gain-only {
  border-left-color: var(--vp-c-green-1);
}
.cmp-group-gain-badge {
  color: var(--vp-c-text-2);
  font-size: 0.75rem;
  font-weight: 400;
}
/* What the target offers in a capability, below what the port loses in it. */
.cmp-group-gain {
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}
.cmp-gain-lead {
  color: var(--vp-c-text-1);
  font-weight: 600;
}
/* A control-code category: the same group shape as a capability. */
.cmp-group-esc {
  margin: 0.5rem 0;
}
.cmp-group-esc .cmp-group-head {
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}
.cmp-group-esc .cmp-group-names {
  line-height: 1.8;
}
.cmp-group-partial-badge {
  color: var(--vp-c-text-2);
  font-size: 0.75rem;
  font-weight: 400;
}
.cmp-group-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.3;
}
.cmp-group-count {
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 0.75rem;
  font-weight: 600;
}
.cmp-group-none {
  color: var(--vp-c-red-1);
  font-size: 0.75rem;
  font-weight: 400;
}
.cmp-group-names {
  margin: 0.35rem 0 0;
  line-height: 1.9;
}
/* Wrap between names, never inside one: an escape like {SHIFT-d} splitting
   across two lines reads as two different codes. */
.cmp-group-names code,
.cmp-change-rule code {
  white-space: nowrap;
}
/* Comma-separated run. The separator is a real text node, not a ::after, so
   the list of lost commands copies and reads out as prose - and it sits after
   any version tag rather than between the name and its tag. */
.cmp-sep {
  color: var(--vp-c-text-3, var(--vp-c-text-2));
}
.cmp-name .cmp-tag {
  margin-left: 0.2rem;
}
.cmp-group-instead {
  margin: 0.4rem 0 0;
  padding-left: 1.1rem;
  font-size: 0.85rem;
}
.cmp-group-instead li {
  margin: 0.15rem 0;
}
/* The authored per-capability advice: one or two sentences plus an optional
   worked example, shown once for the whole group above the per-command
   substitutions run. */
.cmp-group-advice {
  margin: 0.5rem 0 0;
}
.cmp-group-instead-text {
  margin: 0;
  font-size: 0.85rem;
  color: var(--vp-c-text-1);
}
.cmp-example {
  margin: 0.4rem 0 0;
}
.cmp-example-caption {
  margin: 0 0 0.2rem;
  font-size: 0.75rem;
  color: var(--vp-c-text-2);
  font-style: italic;
}
.cmp-example-code {
  margin: 0;
  padding: 0.5rem 0.7rem;
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  font-size: 0.8rem;
  overflow-x: auto;
}
.cmp-reach-for {
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
}
.cmp-more {
  border-left-color: transparent !important;
  justify-content: center;
}
.cmp-expand {
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-brand-1);
  cursor: pointer;
  font-size: 0.85rem;
}
.cmp-expand:hover {
  background: var(--vp-c-brand-soft);
}
.cmp-icon {
  display: inline-flex;
  align-items: center;
  color: var(--vp-c-text-2);
}
.cmp-tag {
  padding: 0 0.35rem;
  border-radius: 4px;
  font-size: 0.7rem;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}
.cmp-desc {
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
}
/* The "do this instead" line, set apart from the neutral description. */
.cmp-instead {
  font-size: 0.85rem;
  color: var(--vp-c-text-1);
  border-left: 2px solid var(--vp-c-brand-1, var(--vp-c-text-3));
  padding-left: 0.5rem;
}
.cmp-notes {
  margin: 0.4rem 0 0;
  padding-left: 1.1rem;
}
.cmp-notes li {
  margin: 0.3rem 0;
  line-height: 1.5;
}
/* The notes for this direction lead the list, and are the more specific of the
   two - marked so they don't read as more of the general target advice. */
.cmp-notes li.cmp-pair-note {
  color: var(--vp-c-text-1);
  font-weight: 500;
}
/* Same word, different meaning: the only differences here that fail silently. */
.cmp-traps h2 {
  color: var(--vp-c-warning-1, var(--vp-c-text-1));
}
.cmp-change-detail {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}
.cmp-arrow {
  color: var(--vp-c-text-3, var(--vp-c-text-2));
}
/* What the target adds, closing the control-code section: a count and a
   pointer, not a second grouped column. */
.cmp-esc-gain {
  margin: 0.75rem 0 0;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}
@media (max-width: 640px) {
  .cmp-facts tbody th {
    width: auto;
  }
}
.cmp-empty {
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
  font-style: italic;
}
</style>
