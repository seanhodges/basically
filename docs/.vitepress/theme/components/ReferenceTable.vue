<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type {
  ReferenceEntry,
  ReferenceTableData,
} from '../../../reference/data/types';
import {
  filterEntries,
  findEntryByName,
  sortEntries,
  type KindFilter,
  type SortKey,
} from '../referenceTable';

const props = defineProps<{ data: ReferenceTableData }>();

const query = ref('');
const kind = ref<KindFilter>('all');
// The keyword pinned by a `?name=` deep link (exact match), highlighted and
// scrolled to on load. Also set when a row's own link is copied, so the click
// confirms which row it captured.
const highlighted = ref<string | null>(null);
// The keyword whose link was just copied, for the transient "copied" tick.
const copied = ref<string | null>(null);
let copiedTimer: ReturnType<typeof setTimeout> | undefined;

// Seed from query params so the in-app docs drawer and shared links can deep
// link into the table: `?q=` seeds the search box (substring, context-aware
// help), `?name=` pins one exact keyword row. Client-only, so SSG stays safe.
onMounted(() => {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q');
  if (q) query.value = q;
  const name = params.get('name');
  if (name) {
    const match = findEntryByName(props.data.entries, name);
    if (match) {
      highlighted.value = match.name;
      // Wait for the rows to render before scrolling to the pinned one.
      nextTick(() => scrollToRow(match.name));
    }
  }
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

/** Canonical display order; BASIC kinds first, then the assembly kinds. */
const KIND_ORDER: ReferenceEntry['kind'][] = [
  'command',
  'function',
  'operator',
  'instruction',
  'directive',
];

/** Inline Lucide-style SVG paths for each entry kind (rendered at ~14px). */
const KIND_META: Record<
  ReferenceEntry['kind'],
  { label: string; plural: string; paths: string }
> = {
  command: {
    label: 'Command',
    plural: 'Commands',
    paths:
      '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
  },
  function: {
    label: 'Function',
    plural: 'Functions',
    paths:
      '<path d="M7 4h2a3 3 0 0 0-3 3v3a3 3 0 0 1-3 3 3 3 0 0 1 3 3v3a3 3 0 0 0 3 3H7"/>',
  },
  operator: {
    label: 'Operator',
    plural: 'Operators',
    paths:
      '<line x1="5" y1="9" x2="19" y2="9"/><line x1="5" y1="15" x2="19" y2="15"/><line x1="14" y1="4" x2="10" y2="20"/>',
  },
  instruction: {
    label: 'Instruction',
    plural: 'Instructions',
    // A CPU chip - the mnemonic that runs on the processor.
    paths:
      '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2"/><path d="M15 2v2"/><path d="M9 20v2"/><path d="M15 20v2"/><path d="M20 9h2"/><path d="M20 14h2"/><path d="M2 9h2"/><path d="M2 14h2"/>',
  },
  directive: {
    label: 'Directive',
    plural: 'Directives',
    // A stack of data - the assembler pseudo-ops that lay out memory/bytes.
    paths:
      '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  },
};

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

const visible = computed(() =>
  sortEntries(
    filterEntries(props.data.entries, query.value, kind.value),
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
        placeholder="Search keyword names…"
        aria-label="Search keyword names"
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
.reftable-name code,
.reftable-syntax {
  white-space: nowrap;
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
</style>
