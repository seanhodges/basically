<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type {
  ReferenceEntry,
  ReferenceTableData,
} from '../../../reference/data/types';
import {
  filterEntries,
  sortEntries,
  type KindFilter,
  type SortKey,
} from '../referenceTable';

const props = defineProps<{ data: ReferenceTableData }>();

const query = ref('');
const kind = ref<KindFilter>('all');

// Seed the search from a `?q=` query param so the in-app docs drawer can deep
// link to a keyword (context-aware help). Client-only, so SSG stays safe.
onMounted(() => {
  const q = new URLSearchParams(window.location.search).get('q');
  if (q) query.value = q;
});
const sortKey = ref<SortKey>('name');
const sortDir = ref<'asc' | 'desc'>('asc');

const KINDS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'command', label: 'Commands' },
  { value: 'function', label: 'Functions' },
  { value: 'operator', label: 'Operators' },
];

/** Inline Lucide-style SVG paths for each entry kind (rendered at ~14px). */
const KIND_META: Record<
  ReferenceEntry['kind'],
  { label: string; paths: string }
> = {
  command: {
    label: 'Command',
    paths:
      '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
  },
  function: {
    label: 'Function',
    paths:
      '<path d="M7 4h2a3 3 0 0 0-3 3v3a3 3 0 0 1-3 3 3 3 0 0 1 3 3v3a3 3 0 0 0 3 3H7"/>',
  },
  operator: {
    label: 'Operator',
    paths:
      '<line x1="5" y1="9" x2="19" y2="9"/><line x1="5" y1="15" x2="19" y2="15"/><line x1="14" y1="4" x2="10" y2="20"/>',
  },
};

const kindList = Object.entries(KIND_META) as [
  ReferenceEntry['kind'],
  { label: string; paths: string },
][];

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
        <tr v-for="e in visible" :key="e.name">
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
