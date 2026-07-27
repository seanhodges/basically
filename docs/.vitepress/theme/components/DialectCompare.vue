<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type {
  EscapeTableData,
  PortingFacts,
  ReferenceTableData,
} from '../../../reference/data/types';
import {
  diffEscapes,
  diffKeywords,
  falseFriendsBetween,
} from '../dialectCompare';
import {
  falseFriends,
  keywordEquivalences,
} from '../../../reference/data/porting';
import { KIND_META } from '../kindMeta';
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

const from = ref(props.dialects[0]?.id ?? '');
const to = ref(props.dialects[1]?.id ?? props.dialects[0]?.id ?? '');
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

// Commands both machines spell alike and mean differently. Nothing else on this
// page can surface them: they match on name, kind and usually syntax, so they
// reach none of the diff buckets while still changing what a program computes.
const traps = computed(() => {
  const s = source.value;
  const t = target.value;
  if (!s || !t) return [];
  return falseFriendsBetween(s.id, t.id, falseFriends);
});

/** "If you need X here, do this instead" for the machine being ported to. */
const substitutions = computed(
  () =>
    new Map(
      (target.value?.facts?.substitutions ?? []).map((s) => [
        s.keyword,
        s.note,
      ]),
    ),
);

const escapeDiff = computed(() => {
  const s = source.value;
  const t = target.value;
  if (!s?.escapes || !t?.escapes) return null;
  return diffEscapes(s.escapes, t.escapes);
});

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
    ['Exponent operator', (f) => f.exponentOperator ?? 'None'],
    ['Screen', (f) => f.screen],
    ['Free program RAM', fmtRam],
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
    { type: CONVERT_MESSAGE, to: t.id, toLabel: t.label },
    window.location.origin,
  );
}
</script>

<template>
  <div class="cmp">
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
    </div>

    <p v-if="sameSelection" class="cmp-note">
      Pick two different dialects to see what changes.
    </p>

    <template v-else-if="source && target && keywordDiff">
      <p class="cmp-summary">
        <strong>{{ source.label }} → {{ target.label }}:</strong>
        {{ keywordDiff.mustReplace.length }} keyword(s) to replace,
        {{ keywordDiff.renamed.length }} to rename,
        {{ keywordDiff.behaviourChanged.length }} changed,
        {{ keywordDiff.newlyAvailable.length }} newly available,
        {{ changedFactCount }} language/hardware difference(s).
      </p>

      <div class="cmp-links">
        <span
          >Full reference:
          <a :href="refLinks(source.id).reference">{{ source.label }}</a>
          (<a :href="refLinks(source.id).hardware">hardware</a>,
          <a :href="refLinks(source.id).escapes">escape codes</a>,
          <a :href="refLinks(source.id).formats">file formats</a>)</span
        >
        <span
          >·
          <a :href="refLinks(target.id).reference">{{ target.label }}</a>
          (<a :href="refLinks(target.id).hardware">hardware</a>,
          <a :href="refLinks(target.id).escapes">escape codes</a>,
          <a :href="refLinks(target.id).formats">file formats</a>)</span
        >
      </div>

      <div v-if="embedded" class="cmp-ai">
        <button type="button" @click="convertWithAi">
          Convert to {{ target.label }} using AI
        </button>
      </div>

      <section
        v-if="target.facts?.portingNotes?.length"
        class="cmp-section cmp-guidance"
      >
        <h2>Writing for {{ target.label }}</h2>
        <ul class="cmp-notes">
          <li v-for="note in target.facts.portingNotes" :key="note">
            {{ note }}
          </li>
        </ul>
      </section>

      <!--
        First, because these are the only differences that fail silently: the
        command exists on both machines, so nothing else on this page flags it,
        and the program runs and quietly computes something else.
      -->
      <section v-if="traps.length" class="cmp-section cmp-traps">
        <h2>Same word, different meaning ({{ traps.length }})</h2>
        <p class="cmp-hint">
          These exist on both machines, so they raise no error — they just do
          something else.
        </p>
        <ul class="cmp-list">
          <li v-for="t in traps" :key="t.keyword">
            <code>{{ t.keyword }}</code>
            <span class="cmp-change-detail">
              <span class="cmp-from">{{ source.label }}: {{ t.from }}</span>
              <span class="cmp-arrow">→</span>
              <span class="cmp-to">{{ target.label }}: {{ t.to }}</span>
            </span>
          </li>
        </ul>
      </section>

      <!-- Language & hardware differences -->
      <section class="cmp-section">
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

      <!-- Keyword differences -->
      <section v-if="keywordDiff.renamed.length" class="cmp-section">
        <h2>Keywords to rename ({{ keywordDiff.renamed.length }})</h2>
        <p class="cmp-hint">
          The same command, spelled differently — a search and replace, not a
          rewrite.
        </p>
        <ul class="cmp-list">
          <li v-for="r in keywordDiff.renamed" :key="r.from.name">
            <code>{{ r.from.name }}</code>
            <span class="cmp-arrow">→</span>
            <code>{{ r.to.name }}</code>
            <span class="cmp-desc">{{ r.to.description }}</span>
          </li>
        </ul>
      </section>

      <section class="cmp-section">
        <h2>Keywords to replace ({{ keywordDiff.mustReplace.length }})</h2>
        <p class="cmp-hint">
          In {{ source.label }} but not {{ target.label }} — rewrite or remove
          these.
        </p>
        <ul class="cmp-list cmp-remove">
          <li v-for="e in keywordDiff.mustReplace" :key="e.name">
            <span class="cmp-icon" :class="`kind-${e.kind}`">
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
                :aria-label="KIND_META[e.kind].label"
                v-html="KIND_META[e.kind].paths"
              />
            </span>
            <code>{{ e.name }}</code>
            <span v-if="e.tag" class="cmp-tag">{{ e.tag }}</span>
            <span class="cmp-desc">{{ e.description }}</span>
            <span v-if="substitutions.get(e.name)" class="cmp-instead">
              {{ substitutions.get(e.name) }}
            </span>
          </li>
          <li v-if="keywordDiff.mustReplace.length === 0" class="cmp-empty">
            Every {{ source.label }} keyword exists in {{ target.label }}.
          </li>
        </ul>
      </section>

      <section class="cmp-section">
        <h2>Changed behaviour ({{ keywordDiff.behaviourChanged.length }})</h2>
        <p class="cmp-hint">
          Same keyword, different kind or syntax — check each use.
        </p>
        <ul class="cmp-list cmp-change">
          <li v-for="c in keywordDiff.behaviourChanged" :key="c.name">
            <code>{{ c.name }}</code>
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
            v-if="keywordDiff.behaviourChanged.length === 0"
            class="cmp-empty"
          >
            No shared keyword changed kind or syntax.
          </li>
        </ul>
      </section>

      <section class="cmp-section">
        <h2>Newly available ({{ keywordDiff.newlyAvailable.length }})</h2>
        <p class="cmp-hint">
          In {{ target.label }} but not {{ source.label }} — you can use these.
        </p>
        <ul class="cmp-list cmp-add">
          <li v-for="e in keywordDiff.newlyAvailable" :key="e.name">
            <span class="cmp-icon" :class="`kind-${e.kind}`">
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
                :aria-label="KIND_META[e.kind].label"
                v-html="KIND_META[e.kind].paths"
              />
            </span>
            <code>{{ e.name }}</code>
            <span v-if="e.tag" class="cmp-tag">{{ e.tag }}</span>
            <span class="cmp-desc">{{ e.description }}</span>
          </li>
          <li v-if="keywordDiff.newlyAvailable.length === 0" class="cmp-empty">
            {{ target.label }} adds no keywords over {{ source.label }}.
          </li>
        </ul>
      </section>

      <!-- Escape-code differences -->
      <section class="cmp-section">
        <h2>Control &amp; escape codes</h2>
        <template v-if="escapeDiff">
          <p class="cmp-hint">
            Embedded colour/graphics control codes differ between the machines.
          </p>
          <div class="cmp-esc-cols">
            <div>
              <h3>To replace ({{ escapeDiff.mustReplace.length }})</h3>
              <ul class="cmp-list cmp-remove">
                <li v-for="e in escapeDiff.mustReplace" :key="e.escape">
                  <code>{{ e.escape }}</code>
                  <span class="cmp-desc">{{ e.description }}</span>
                </li>
                <li
                  v-if="escapeDiff.mustReplace.length === 0"
                  class="cmp-empty"
                >
                  None.
                </li>
              </ul>
            </div>
            <div>
              <h3>Newly available ({{ escapeDiff.newlyAvailable.length }})</h3>
              <ul class="cmp-list cmp-add">
                <li v-for="e in escapeDiff.newlyAvailable" :key="e.escape">
                  <code>{{ e.escape }}</code>
                  <span class="cmp-desc">{{ e.description }}</span>
                </li>
                <li
                  v-if="escapeDiff.newlyAvailable.length === 0"
                  class="cmp-empty"
                >
                  None.
                </li>
              </ul>
            </div>
          </div>
        </template>
        <p v-else class="cmp-hint">
          One of these dialects has no documented escape-code set, so there is
          nothing to compare.
        </p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.cmp-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem;
  margin: 1rem 0;
}
.cmp-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
}
.cmp-field select {
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-size: 0.9rem;
}
.cmp-swap,
.cmp-copy {
  padding: 0.4rem 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  cursor: pointer;
  font-size: 0.9rem;
}
.cmp-copy.copied {
  color: var(--vp-c-green-1);
  border-color: var(--vp-c-green-1);
}
.cmp-summary {
  padding: 0.6rem 0.8rem;
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
}
.cmp-links {
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}
.cmp-ai {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0.75rem 0;
}
.cmp-ai button {
  padding: 0.45rem 0.8rem;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 6px;
  background: var(--vp-c-brand-1);
  color: #fff;
  cursor: pointer;
  font-size: 0.85rem;
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
.cmp-icon {
  display: inline-flex;
  align-items: center;
  color: var(--vp-c-text-2);
}
.cmp-icon.kind-function {
  color: var(--vp-c-green-1);
}
.cmp-icon.kind-operator {
  color: var(--vp-c-yellow-1);
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
