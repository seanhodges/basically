<script setup lang="ts">
import {
  computed,
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
} from '../../../reference/data/types';
import {
  capabilitySections,
  composeGuidance,
  diffEscapes,
  diffKeywords,
  escapeSections,
  escapeTableForMachine,
  tableForMachine,
  type CapabilitySection,
  type EscapeSection,
  type KeywordChange,
} from '../dialectCompare';
import {
  falseFriends,
  keywordEquivalences,
  pairPortingNotes,
} from '../../../reference/data/porting';
import { domainGuidance } from '../../../reference/data/domain-guidance';
import type { DomainGuidance } from '../../../reference/data/domain-guidance';
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

// Message type the embedded app listens for (src/components/DocsDrawer.tsx).
// Kept in sync with that file by string, like DOCS_CLOSE_MESSAGE there.
const CONVERT_MESSAGE = 'basically:compare-convert';

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

const keywordDiff = computed(() => {
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

const escapeDiff = computed(() => {
  if (!sourceEscapes.value || !targetEscapes.value) return null;
  return diffEscapes(sourceEscapes.value, targetEscapes.value);
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

const pairKey = computed(() => `${from.value}:${to.value}`);

const falseFriendsList = useTruncatedList(
  () => guidance.value.falseFriends,
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
 */
const summary = computed(() => {
  const t = target.value;
  const diff = keywordDiff.value;
  if (!t || !diff) return '';
  const work: string[] = [];
  if (diff.mustReplace.length)
    work.push(
      `${count(diff.mustReplace.length, 'command')} to rewrite across ` +
        `${count(losingCount.value, 'capability area')}`,
    );
  if (diff.renamed.length)
    work.push(`${count(diff.renamed.length, 'command')} to rename`);
  if (changedCount.value)
    work.push(`${count(changedCount.value, 'command')} whose usage differs`);

  const facts = changedFactCount.value;
  const sentences = work.length ? [`${listOf(work)}.`] : [];
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
      g.falseFriends.length > 0,
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
      escReplaceSections.value.length + escapeAdded.value > 0,
      'escape-codes',
      'Control & escape codes',
    ],
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
  if (f && optionFor(f)) from.value = f;
  if (t && optionFor(t)) to.value = t;
});

function convertWithAi() {
  const t = target.value;
  if (!t) return;
  window.parent.postMessage(
    { type: CONVERT_MESSAGE, toId: t.id, toLabel: t.name },
    window.location.origin,
  );
}
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
        v-if="guidance.falseFriends.length"
        id="false-friends"
        class="cmp-section cmp-traps"
      >
        <h2>
          Same word, different meaning ({{ guidance.falseFriends.length }})
        </h2>
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
        v-if="escReplaceSections.length || escapeAdded"
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
        <p v-if="escapeAdded && showAdditions" class="cmp-esc-gain">
          {{ target.name }} adds {{ count(escapeAdded, 'code') }} across
          {{ count(escapeAddedCategories, 'category', 'categories') }} the
          program has not used —
          <a :href="refLinks(target.page).escapes"
            >see its escape-code reference</a
          >.
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
