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
  capabilityBrief,
  composeGuidance,
  diffEscapes,
  diffKeywords,
  domainSections,
  escapeSections,
  type CapabilityBrief,
  type DomainSection,
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

/** One selectable dialect: its reference/escape tables and porting facts. */
interface DialectOption {
  /** Page slug (e.g. "zx81"), used for deep links and reference links. */
  id: string;
  /** Human name shown in the dropdown. */
  label: string;
  reference: ReferenceTableData;
  escapes?: EscapeTableData;
  facts?: PortingFacts;
}

const props = defineProps<{ dialects: DialectOption[] }>();

// Message type the embedded app listens for (src/components/DocsDrawer.tsx).
// Kept in sync with that file by string, like DOCS_CLOSE_MESSAGE there.
const CONVERT_MESSAGE = 'basically:compare-convert';

// The pair the page opens on when the URL names no `?from=`/`?to=`: the two
// most-used dialects, and a genuinely instructive port (integer-ish Microsoft
// BASIC with PEEK/POKE graphics → a dialect with PLOT/DRAW/CIRCLE and colour).
// Falls back to the first two options if either id is ever unregistered.
const DEFAULT_FROM = 'commodore';
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

const source = computed(() => optionFor(from.value));
const target = computed(() => optionFor(to.value));
const sameSelection = computed(() => from.value === to.value);

const keywordDiff = computed(() => {
  const s = source.value;
  const t = target.value;
  if (!s || !t) return null;
  return diffKeywords(s.reference, t.reference, {
    from: s.id,
    to: t.id,
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
    from: from.value,
    to: to.value,
    targetFacts: target.value?.facts,
    pairNotes: pairPortingNotes,
    falseFriends,
    domainGuidance,
  }),
);

const escapeDiff = computed(() => {
  const s = source.value;
  const t = target.value;
  if (!s?.escapes || !t?.escapes) return null;
  return diffEscapes(s.escapes, t.escapes);
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
const renamedList = useTruncatedList(
  () => keywordDiff.value?.renamed ?? [],
  pairKey,
);

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

/** "1 command" / "3 commands", so the summary reads as a sentence. */
function count(n: number, singular: string): string {
  return `${n} ${n === 1 ? singular : `${singular}s`}`;
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
const escAddSections = computed<EscapeSection[]>(() => {
  const t = target.value;
  return escapeDiff.value && t?.escapes
    ? escapeSections(escapeDiff.value.newlyAvailable, t.escapes)
    : [];
});

// The commands to replace are grouped by capability rather than capped. A group
// names its commands in one run instead of giving each a row, so 41 lost
// graphics commands are a wrapped line and nothing has to be hidden - hence no
// `useTruncatedList` here. Capabilities the target has no equivalent of at all
// lead, because "you lose sound entirely" is the headline, not entry 94 of an
// alphabetical list.
const replaceSections = computed<DomainSection[]>(() => {
  const diff = keywordDiff.value;
  const t = target.value;
  if (!diff || !t) return [];
  return domainSections(
    diff.mustReplace,
    t.reference,
    DOMAIN_ORDER,
    domainGuidance,
    t.id,
  );
});

/** The authored (target, capability) advice for a group, if any. */
function domainAdvice(section: DomainSection): DomainGuidance | undefined {
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
  section: DomainSection,
): { name: string; note: string }[] {
  const notes = guidance.value.substitutions;
  return section.entries.flatMap((e) => {
    const note = notes.get(e.name);
    return note ? [{ name: e.name, note }] : [];
  });
}

// The "newly available" section summarised by capability rather than listed
// command by command: at most thirteen lines against up to 147 rows, so no
// useTruncatedList is needed here (see the deleted newlyAvailableList).
const additionsBrief = computed<CapabilityBrief[]>(() => {
  const diff = keywordDiff.value;
  const t = target.value;
  if (!diff || !t) return [];
  return capabilityBrief(
    diff.newlyAvailable,
    t.id,
    domainGuidance,
    DOMAIN_ORDER,
  );
});

/** The trailing bucket is unreachable while every BASIC row carries a domain. */
function domainLabel(section: DomainSection): string {
  return section.domain ? DOMAIN_META[section.domain].label : 'Other';
}
function domainPaths(section: DomainSection): string {
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

const factRows = computed<FactRow[]>(() => {
  const s = source.value?.facts;
  const t = target.value?.facts;
  if (!s || !t) return [];
  const rows: [string, (f: PortingFacts) => string][] = [
    ['Line numbers', (f) => f.lineNumberRange],
    ['Statements per line', fmtSeparator],
    ['Conditionals', fmtElse],
    ['LET on assignment', fmtLet],
    ['Variable names', (f) => f.variableNaming],
    // Whether the target has fractions at all decides how much of the port is
    // arithmetic, so it sits with the language rules rather than the hardware.
    ['Numbers', (f) => f.numberHandling],
    ['Exponent operator', (f) => f.exponentOperator ?? 'None'],
    ['Screen', (f) => f.screen],
    ['Screen base', (f) => f.screenBase ?? 'No dedicated screen RAM'],
    ['Free program RAM', fmtRam],
    ['Program start', (f) => f.programStart ?? '—'],
    ['Colour', (f) => f.colour],
    ['Sound', (f) => f.sound],
    ['Writing memory', (f) => f.memoryWriteSyntax],
    ['Address notation', fmtAddress],
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
        `${count(replaceSections.value.length, 'capability area')}`,
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
  if (additionsBrief.value.length)
    rest.push(
      `${t.label} adds ${count(additionsBrief.value.length, 'capability area')}`,
    );
  sentences.push(`${listOf(rest)}.`);
  return sentences.join(' ');
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
    [g.pairNotes.length > 0, 'this-pair', 'This pair'],
    [
      g.targetNotes.length > 0,
      'writing-for-target',
      `Writing for ${target.value?.label}`,
    ],
    [
      g.falseFriends.length > 0,
      'false-friends',
      'Same word, different meaning',
    ],
    [replaceSections.value.length > 0, 'to-replace', 'Keywords to replace'],
    [additionsBrief.value.length > 0, 'newly-available', 'Newly available'],
    [keywordDiff.value.renamed.length > 0, 'to-rename', 'Keywords to rename'],
    [
      parensChanged.value.length + detailedChanges.value.length > 0,
      'changed-behaviour',
      'Changed behaviour',
    ],
    [
      escReplaceSections.value.length + escAddSections.value.length > 0,
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
    { type: CONVERT_MESSAGE, toId: t.id, toLabel: t.label },
    window.location.origin,
  );
}
</script>

<template>
  <div class="cmp">
    <!--
      The guidance that does not change with the pair sits here, with the page
      intro and above the picker, so the sections below run pair-specific from
      first to last instead of being split by generic prose.
    -->
    <div class="cmp-intro"><slot /></div>

    <div class="cmp-panel">
      <div class="cmp-controls">
        <label class="cmp-field">
          <span>Porting from</span>
          <select v-model="from" @change="syncUrl">
            <option v-for="d in dialects" :key="d.id" :value="d.id">
              {{ d.label }}
            </option>
          </select>
        </label>
        <button
          type="button"
          class="cmp-swap"
          title="Swap source and target"
          aria-label="Swap source and target"
          @click="swap"
        >
          ⇄
        </button>
        <label class="cmp-field">
          <span>to</span>
          <select v-model="to" @change="syncUrl">
            <option v-for="d in dialects" :key="d.id" :value="d.id">
              {{ d.label }}
            </option>
          </select>
        </label>
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
        Pick two different dialects to see what changes.
      </p>

      <template v-else-if="source && target && keywordDiff">
        <p class="cmp-summary">
          <strong>{{ source.label }} → {{ target.label }}:</strong>
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
          <a :href="refLinks(source.id).reference">{{ source.label }}</a>
          (<a :href="refLinks(source.id).hardware">hardware</a>,
          <a :href="refLinks(source.id).escapes">escape codes</a>,
          <a :href="refLinks(source.id).formats">file formats</a>) ·
          <a :href="refLinks(target.id).reference">{{ target.label }}</a>
          (<a :href="refLinks(target.id).hardware">hardware</a>,
          <a :href="refLinks(target.id).escapes">escape codes</a>,
          <a :href="refLinks(target.id).formats">file formats</a>)
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
              <th>{{ source.label }}</th>
              <th>{{ target.label }}</th>
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
        Notes specific to this direction: the few pairs close enough, or
        trap-laden enough, that the target-only notes and the false-friend
        warnings cannot carry the advice on their own.
      -->
      <section
        v-if="guidance.pairNotes.length"
        id="this-pair"
        class="cmp-section cmp-guidance"
      >
        <h2>{{ source.label }} → {{ target.label }}: this pair</h2>
        <ul class="cmp-notes">
          <li v-for="note in guidance.pairNotes" :key="note">
            {{ note }}
          </li>
        </ul>
      </section>

      <section
        v-if="guidance.targetNotes.length"
        id="writing-for-target"
        class="cmp-section cmp-guidance"
      >
        <h2>Writing for {{ target.label }}</h2>
        <ul class="cmp-notes">
          <li v-for="note in guidance.targetNotes" :key="note">
            {{ note }}
          </li>
        </ul>
      </section>

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
              <span class="cmp-from">{{ source.label }}: {{ t.from }}</span>
              <span class="cmp-arrow">→</span>
              <span class="cmp-to">{{ target.label }}: {{ t.to }}</span>
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
        The work itself, and so the last of the sections a porter acts on:
        grouped by capability, not capped. A group names its commands in one
        run, so every lost command is shown and capabilities the port does not
        touch are simply absent rather than collapsed behind a control.
      -->
      <section
        v-if="replaceSections.length"
        id="to-replace"
        class="cmp-section"
      >
        <h2>Keywords to replace ({{ keywordDiff.mustReplace.length }})</h2>
        <p class="cmp-hint">
          In {{ source.label }} but not {{ target.label }} — rewrite or remove
          these. Grouped by what they do, with the capabilities
          {{ target.label }} has no equivalent of at all first.
        </p>
        <div
          v-for="s in replaceSections"
          :key="s.domain ?? 'other'"
          class="cmp-group"
          :class="{
            'cmp-group-absent': s.support === 'none',
            'cmp-group-partial': s.support === 'partial',
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
            <span class="cmp-group-count">{{ s.entries.length }}</span>
            <span v-if="s.support === 'none'" class="cmp-group-none">
              nothing like it in {{ target.label }}
            </span>
            <span
              v-else-if="s.support === 'partial'"
              class="cmp-group-partial-badge"
            >
              only partly covered in {{ target.label }}
            </span>
          </h3>
          <p class="cmp-group-names">
            <span v-for="(e, i) in s.entries" :key="e.name" class="cmp-name">
              <code>{{ e.name }}</code
              ><span v-if="e.tag" class="cmp-tag">{{ e.tag }}</span
              ><span v-if="i < s.entries.length - 1" class="cmp-sep">, </span>
            </span>
          </p>
          <div v-if="domainAdvice(s)?.instead" class="cmp-group-advice">
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
        </div>
      </section>

      <section
        v-if="additionsBrief.length"
        id="newly-available"
        class="cmp-section"
      >
        <h2>
          Newly available ({{ keywordDiff.newlyAvailable.length }} across
          {{ additionsBrief.length }} capability areas)
        </h2>
        <p class="cmp-hint">
          In {{ target.label }} but not {{ source.label }}, summarised by
          capability rather than listed command by command — see the full
          reference for every one.
        </p>
        <ul class="cmp-list cmp-brief">
          <li v-for="b in additionsBrief" :key="b.domain">
            <span class="cmp-icon">
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
                :aria-label="DOMAIN_META[b.domain].label"
                v-html="DOMAIN_META[b.domain].paths"
              />
            </span>
            <strong>{{ DOMAIN_META[b.domain].label }}</strong>
            <span class="cmp-group-count">{{ b.count }}</span>
            <span class="cmp-desc">{{ b.summary }}</span>
            <span v-if="b.reachFor.length" class="cmp-reach-for">
              e.g.
              <span v-for="(n, i) in b.reachFor" :key="n">
                <code>{{ n }}</code
                ><span v-if="i < b.reachFor.length - 1">, </span>
              </span>
            </span>
            <a :href="refLinks(target.id).reference" class="cmp-reach-link"
              >Full {{ target.label }} reference →</a
            >
          </li>
        </ul>
      </section>

      <!-- From here down the page is reference rather than work. -->
      <section
        v-if="keywordDiff.renamed.length"
        id="to-rename"
        class="cmp-section"
      >
        <h2>Keywords to rename ({{ keywordDiff.renamed.length }})</h2>
        <p class="cmp-hint">
          The same command, spelled differently — a search and replace, not a
          rewrite.
        </p>
        <ul class="cmp-list">
          <li v-for="r in renamedList.visible" :key="r.from.name">
            <code>{{ r.from.name }}</code>
            <span class="cmp-arrow">→</span>
            <code>{{ r.to.name }}</code>
            <span class="cmp-desc">{{ r.to.description }}</span>
          </li>
          <li
            v-if="renamedList.hasMore && !renamedList.expanded"
            class="cmp-more"
          >
            <button
              type="button"
              class="cmp-expand"
              @click="renamedList.expand()"
            >
              Show {{ renamedList.remaining }} more…
            </button>
          </li>
        </ul>
      </section>

      <section v-if="changedCount" id="changed-behaviour" class="cmp-section">
        <h2>Changed behaviour ({{ changedCount }})</h2>
        <p class="cmp-hint">
          Same keyword, different kind or arguments — check each use.
        </p>
        <!--
          One rule of the target language, named once with the keywords it
          applies to, rather than repeated as a row each: on Commodore →
          Spectrum this alone would otherwise be fifteen rows saying the same
          thing.
        -->
        <p v-if="parensChanged.length" class="cmp-change-rule">
          {{ parensChanged.length }} differ only in whether the argument is
          bracketed — write them as {{ target.label }} does:
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
                >{{ source.label }}: {{ c.from.kind }} ·
                <code>{{ c.from.syntax }}</code></span
              >
              <span class="cmp-arrow">→</span>
              <span class="cmp-to"
                >{{ target.label }}: {{ c.to.kind }} ·
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
        Grouped by what the codes do, in each machine's own category order, and
        not capped: the same treatment the commands to replace get. An
        alphabetical cap buried the colour and cursor codes a screen layout
        depends on under the block-graphics keycaps.
      -->
      <section
        v-if="escReplaceSections.length || escAddSections.length"
        id="escape-codes"
        class="cmp-section"
      >
        <h2>Control &amp; escape codes</h2>
        <p class="cmp-hint">
          Embedded colour and graphics control codes differ between the
          machines. Grouped by what they do; each machine's escape-code
          reference gives every code's meaning.
        </p>
        <div class="cmp-esc-cols">
          <div>
            <h3>To replace ({{ escapeDiff?.mustReplace.length ?? 0 }})</h3>
            <div
              v-for="s in escReplaceSections"
              :key="s.category ?? 'other'"
              class="cmp-group cmp-group-esc"
            >
              <h4 class="cmp-group-head">
                {{ s.label }}
                <span class="cmp-group-count">{{ s.entries.length }}</span>
              </h4>
              <p class="cmp-group-names">
                <span
                  v-for="(e, i) in s.entries"
                  :key="e.escape"
                  class="cmp-name"
                >
                  <code>{{ e.escape }}</code
                  ><span v-if="i < s.entries.length - 1" class="cmp-sep"
                    >,
                  </span>
                </span>
              </p>
            </div>
            <p v-if="!escReplaceSections.length" class="cmp-empty">None.</p>
          </div>
          <div>
            <h3>
              Newly available ({{ escapeDiff?.newlyAvailable.length ?? 0 }})
            </h3>
            <div
              v-for="s in escAddSections"
              :key="s.category ?? 'other'"
              class="cmp-group cmp-group-esc cmp-group-add"
            >
              <h4 class="cmp-group-head">
                {{ s.label }}
                <span class="cmp-group-count">{{ s.entries.length }}</span>
              </h4>
              <p class="cmp-group-names">
                <span
                  v-for="(e, i) in s.entries"
                  :key="e.escape"
                  class="cmp-name"
                >
                  <code>{{ e.escape }}</code
                  ><span v-if="i < s.entries.length - 1" class="cmp-sep"
                    >,
                  </span>
                </span>
              </p>
            </div>
            <p v-if="!escAddSections.length" class="cmp-empty">None.</p>
          </div>
        </div>
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
.cmp-intro {
  margin-top: 2rem;
}
.cmp-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem;
  margin: 0;
}
.cmp-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
}
/* Inputs sit on the soft panel, so give them the base background to lift
   them off it. */
.cmp-field select {
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 0.9rem;
}
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
   this section no longer uses. */
.cmp-group {
  margin: 0.75rem 0;
  padding: 0.5rem 0 0.5rem 0.7rem;
  border-left: 3px solid var(--vp-c-red-1);
}
/* The capabilities the target has no equivalent of - the ones that lead. */
.cmp-group.cmp-group-absent {
  background: var(--vp-c-red-soft);
}
/* Capabilities the target only partly covers - between "none" and "full". */
.cmp-group.cmp-group-partial {
  border-left-color: var(--vp-c-yellow-1);
}
/* A control-code category: the same group shape, in the two escape columns. */
.cmp-group-esc {
  margin: 0.5rem 0;
}
.cmp-group-esc.cmp-group-add {
  border-left-color: var(--vp-c-green-1);
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
/* The "newly available" capability brief: one line per capability rather
   than a row per command. */
.cmp-brief li {
  flex-direction: column;
  align-items: flex-start;
  border-left-color: var(--vp-c-green-1);
  gap: 0.2rem;
}
.cmp-reach-for {
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
}
.cmp-reach-link {
  font-size: 0.8rem;
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
.cmp-esc-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
@media (max-width: 640px) {
  .cmp-esc-cols {
    grid-template-columns: 1fr;
  }
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
