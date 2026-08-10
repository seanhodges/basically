<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import type { ReferenceTableData } from '../../../../src/reference/types';
import {
  filterEntries,
  findEntryByName,
  sortEntries,
  type DomainFilter,
  type KindFilter,
  type SortKey,
} from '../referenceTable';
import { useDeepLinkParams } from '../deepLinkParams';
import { KIND_META, KIND_ORDER } from '../kindMeta';
import { DOMAIN_META, DOMAIN_ORDER } from '../domainMeta';
import { placeholdersUsed } from '../../../../src/reference/placeholders';

const props = defineProps<{ data: ReferenceTableData }>();

// The argument legend, generated from the rows rather than written by hand, so a
// page never explains a placeholder it does not use and can never fall behind the
// data. `data.placeholders` carries the names peculiar to this machine; the shared
// vocabulary comes from src/reference/placeholders.ts.
const argumentLegend = computed(() =>
  placeholdersUsed(props.data.entries, props.data.placeholders ?? []),
);

const query = ref('');
const kind = ref<KindFilter>('all');
const domain = ref<DomainFilter>('all');
// The keyword pinned by a `?name=` deep link (exact match), highlighted and
// scrolled to on load. Also set when a row's own link is copied, so the click
// confirms which row it captured.
const highlighted = ref<string | null>(null);
// The keyword whose link was just copied, for the transient "copied" tick.
const copied = ref<string | null>(null);
let copiedTimer: ReturnType<typeof setTimeout> | undefined;

// Seed from query params so the in-app docs drawer and shared links can deep
// link into the table: `?q=` seeds the search box (substring, context-aware
// help), `?name=` pins one exact keyword row. Re-runs when the drawer routes
// this frame to a new topic on the same page, which never remounts us.
useDeepLinkParams(({ q, name, domain: d }) => {
  query.value = q ?? '';
  const known = presentDomains.value.find((p) => p === d);
  domain.value = known ?? 'all';
  const match = name ? findEntryByName(props.data.entries, name) : undefined;
  highlighted.value = match?.name ?? null;
  // Wait for the rows to render before scrolling to the pinned one.
  if (match) nextTick(() => scrollToRow(match.name));
});

onBeforeUnmount(() => clearTimeout(copiedTimer));

function scrollToRow(name: string) {
  const row = document.querySelector<HTMLElement>(
    `[data-ref-name="${CSS.escape(name)}"]`,
  );
  row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

/** Copy a `?name=` deep link to this keyword, and pin it so the click confirms. */
async function copyLink(name: string) {
  const { origin, pathname } = window.location;
  const url = `${origin}${pathname}?name=${encodeURIComponent(name)}`;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    // Clipboard blocked (insecure context or denied permission); the address
    // bar still reflects the link below so it can be copied by hand.
  }
  highlighted.value = name;
  history.replaceState(history.state, '', url);
  copied.value = name;
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    if (copied.value === name) copied.value = null;
  }, 1500);
}
const sortKey = ref<SortKey>('name');
const sortDir = ref<'asc' | 'desc'>('asc');

// The kinds this particular table actually contains, in canonical order, so a
// BASIC page shows only command/function/operator and an assembly page shows
// only instruction/directive - the component itself stays generic.
const presentKinds = computed(() => {
  const seen = new Set(props.data.entries.map((e) => e.kind));
  return KIND_ORDER.filter((k) => seen.has(k));
});

const KINDS = computed<{ value: KindFilter; label: string }[]>(() => [
  { value: 'all', label: 'All' },
  ...presentKinds.value.map((k) => ({ value: k, label: KIND_META[k].plural })),
]);

const kindList = computed(() =>
  presentKinds.value.map((k) => [k, KIND_META[k]] as const),
);

// The capability domains this table actually uses, in canonical order. The two
// assembly pages carry no domains, so this is empty there and the whole chip
// row disappears - no special-casing needed for them.
const presentDomains = computed(() => {
  const seen = new Set(props.data.entries.map((e) => e.domain));
  return DOMAIN_ORDER.filter((d) => seen.has(d));
});

// Whether this page's machines let a keyword be typed short at all. The
// Sinclair pages never do - a keyword is a keystroke there, not a spelling - so
// they say nothing about spellings rather than offering to search for something
// none of their rows carry.
const hasAbbreviations = computed(() =>
  props.data.entries.some((e) => (e.abbreviations ?? []).length > 0),
);

const searchLabel = computed(() =>
  hasAbbreviations.value
    ? 'Search keyword names and short spellings'
    : 'Search keyword names',
);

const visible = computed(() =>
  sortEntries(
    filterEntries(props.data.entries, query.value, kind.value, domain.value),
    sortKey.value,
    sortDir.value,
  ),
);

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortDir.value = 'asc';
  }
}

function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
  if (sortKey.value !== key) return 'none';
  return sortDir.value === 'asc' ? 'ascending' : 'descending';
}
</script>

<template>
  <div class="reftable">
    <div class="reftable-controls">
      <input
        v-model="query"
        type="search"
        class="reftable-search"
        :placeholder="searchLabel + '…'"
        :aria-label="searchLabel"
      />
      <div class="reftable-kinds" role="group" aria-label="Filter by kind">
        <button
          v-for="k in KINDS"
          :key="k.value"
          type="button"
          class="reftable-kind"
          :class="{ active: kind === k.value }"
          @click="kind = k.value"
        >
          {{ k.label }}
        </button>
      </div>
    </div>

    <!--
      Capability chips, a distinct smaller second row so the header does not
      read as one long strip of controls. Orthogonal to the kind chips: the two
      filters AND together and neither resets the other.
    -->
    <div
      v-if="presentDomains.length"
      class="reftable-domains"
      role="group"
      aria-label="Filter by capability"
    >
      <button
        type="button"
        class="reftable-domain"
        :class="{ active: domain === 'all' }"
        @click="domain = 'all'"
      >
        All
      </button>
      <button
        v-for="d in presentDomains"
        :key="d"
        type="button"
        class="reftable-domain"
        :class="{ active: domain === d }"
        @click="domain = d"
      >
        {{ DOMAIN_META[d].label }}
      </button>
    </div>

    <p class="reftable-legend">
      <span v-for="[k, meta] in kindList" :key="k" class="reftable-legend-item">
        <span class="reftable-icon-box" :class="`kind-${k}`">
          <svg
            class="reftable-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            role="img"
            :aria-label="meta.label"
            v-html="meta.paths"
          />
        </span>
        {{ meta.label }}
      </span>
    </p>

    <table class="reftable-table">
      <thead>
        <tr>
          <th :aria-sort="ariaSort('name')">
            <button
              type="button"
              class="reftable-sort"
              @click="toggleSort('name')"
            >
              Name
              <span v-if="sortKey === 'name'">{{
                sortDir === 'asc' ? '▲' : '▼'
              }}</span>
            </button>
          </th>
          <th>Syntax &amp; description</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="e in visible"
          :key="e.name"
          :data-ref-name="e.name"
          :class="{ 'reftable-row-active': e.name === highlighted }"
        >
          <td class="reftable-name">
            <span
              class="reftable-icon-box"
              :class="`kind-${e.kind}`"
              :title="KIND_META[e.kind].label"
            >
              <svg
                class="reftable-icon"
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
            <!--
              The short spellings the machine takes for this keyword, beside the
              name because that is the question a reader arrives with: they have
              `P.` or `?` in a listing and want to know what it is. Searchable
              too, so the listing's own spelling finds the row.
            -->
            <span
              v-for="a in e.abbreviations"
              :key="a"
              class="reftable-abbr"
              :title="`Can be typed as ${a}`"
              >{{ a }}</span
            >
            <span v-if="e.tag" class="reftable-tag">{{ e.tag }}</span>
            <button
              type="button"
              class="reftable-link"
              :class="{ copied: copied === e.name }"
              :title="
                copied === e.name ? 'Link copied' : `Copy link to ${e.name}`
              "
              :aria-label="
                copied === e.name
                  ? `Link to ${e.name} copied`
                  : `Copy deep link to ${e.name}`
              "
              @click="copyLink(e.name)"
            >
              <svg
                v-if="copied === e.name"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                role="img"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <svg
                v-else
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                role="img"
                aria-hidden="true"
              >
                <path
                  d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
                />
                <path
                  d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
                />
              </svg>
            </button>
          </td>
          <td class="reftable-detail">
            <code class="reftable-syntax">{{ e.syntax }}</code>
            <div class="reftable-desc">{{ e.description }}</div>
          </td>
        </tr>
        <tr v-if="visible.length === 0">
          <td colspan="2" class="reftable-empty">
            No keywords match “{{ query }}”.
          </td>
        </tr>
      </tbody>
    </table>

    <details v-if="argumentLegend.length" class="reftable-args">
      <summary>Argument notation</summary>
      <p>
        Anything in <code>&lt;angle brackets&gt;</code> is a value you supply;
        everything else is typed exactly as shown. <code>[</code>square
        brackets<code>]</code> mark an optional part, <code>|</code> separates
        alternatives, and <code>…</code> means the part before it can repeat.
        The arguments on this page are:
      </p>
      <dl>
        <template v-for="p in argumentLegend" :key="p.id">
          <dt>
            <code>&lt;{{ p.id }}&gt;</code>
          </dt>
          <dd>{{ p.meaning }}</dd>
        </template>
      </dl>
    </details>

    <p class="reftable-count">
      Showing {{ visible.length }} of {{ data.entries.length }} keywords
    </p>
  </div>
</template>

<style scoped>
.reftable-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  margin: 1rem 0;
}
.reftable-search {
  flex: 1 1 16rem;
  padding: 0.45rem 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-size: 0.9rem;
}
.reftable-kinds {
  display: flex;
  gap: 0.25rem;
}
/* A second, deliberately smaller chip row: the header already carries a search
   box, the kind chips and a legend, so the capability filter is subordinate to
   them rather than a second peer strip. */
.reftable-domains {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin: -0.5rem 0 1rem;
}
.reftable-domain {
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: 0.75rem;
  cursor: pointer;
}
.reftable-domain.active {
  background: var(--vp-c-brand-soft);
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.reftable-kind {
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
  cursor: pointer;
}
.reftable-kind.active {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  color: #fff;
}
.reftable-table {
  display: table;
  width: 100%;
  border-collapse: collapse;
}
.reftable-table th,
.reftable-table td {
  text-align: left;
  vertical-align: top;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--vp-c-divider);
}
.reftable-sort {
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  font-weight: 600;
  color: var(--vp-c-text-1);
  cursor: pointer;
}
.reftable-table th:first-child,
.reftable-name {
  width: 1%;
  white-space: nowrap;
}
.reftable-name code {
  white-space: nowrap;
}
/* A usage string is the one cell that can outgrow its column - the Amstrad's
   SOUND runs to seven arguments - so it wraps where the keyword name never
   should. */
.reftable-syntax {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.reftable-row-active > td {
  background: var(--vp-c-brand-soft);
}
.reftable-link {
  display: inline-flex;
  align-items: center;
  margin-left: 0.35rem;
  padding: 0.1rem;
  border: 0;
  border-radius: 4px;
  background: none;
  color: var(--vp-c-text-3, var(--vp-c-text-2));
  line-height: 0;
  cursor: pointer;
  opacity: 0.55;
  vertical-align: -0.28em;
  transition:
    opacity 0.15s,
    color 0.15s;
}
.reftable-link:hover,
.reftable-link:focus-visible {
  opacity: 1;
  color: var(--vp-c-brand-1);
}
.reftable-link.copied {
  opacity: 1;
  color: var(--vp-c-green-1);
}
.reftable-icon-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  margin-right: 0.45rem;
  vertical-align: -0.28em;
  border-radius: 5px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
}
.reftable-icon-box.kind-function {
  color: var(--vp-c-green-1);
}
.reftable-icon-box.kind-operator {
  color: var(--vp-c-yellow-1);
}
.reftable-icon-box.kind-instruction {
  color: var(--vp-c-brand-1);
}
.reftable-icon-box.kind-directive {
  color: var(--vp-c-purple-1, var(--vp-c-brand-1));
}
.reftable-icon {
  display: block;
}
.reftable-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  margin: 0 0 0.5rem;
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
}
.reftable-legend-item {
  display: inline-flex;
  align-items: center;
}
.reftable-syntax {
  display: inline-block;
  margin-bottom: 0.25rem;
}
/* A short spelling reads as an alternative name, so it sits in the name cell in
   the same monospace face, dimmed and boxed to keep the canonical spelling the
   one the eye lands on first. */
.reftable-abbr {
  display: inline-block;
  margin-left: 0.35rem;
  padding: 0 0.3rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
}
.reftable-tag {
  display: inline-block;
  margin-left: 0.4rem;
  padding: 0 0.35rem;
  border-radius: 4px;
  font-size: 0.7rem;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}
.reftable-empty,
.reftable-count {
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
}

.reftable-args {
  margin: 1.25rem 0 0;
  padding: 0.6rem 0.9rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  font-size: 0.85rem;
}
.reftable-args summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--vp-c-text-2);
}
.reftable-args p {
  margin: 0.6rem 0;
  color: var(--vp-c-text-2);
  line-height: 1.6;
}
.reftable-args dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.2rem 0.7rem;
  margin: 0;
}
.reftable-args dt {
  white-space: nowrap;
}
.reftable-args dd {
  margin: 0;
  color: var(--vp-c-text-2);
}
</style>
