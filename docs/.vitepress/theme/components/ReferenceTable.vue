<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ReferenceTableData } from '../../../reference/data/types';
import {
  filterEntries,
  sortEntries,
  type KindFilter,
  type SortKey,
} from '../referenceTable';

const props = defineProps<{ data: ReferenceTableData }>();

const query = ref('');
const kind = ref<KindFilter>('all');
const sortKey = ref<SortKey>('name');
const sortDir = ref<'asc' | 'desc'>('asc');

const KINDS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'command', label: 'Commands' },
  { value: 'function', label: 'Functions' },
  { value: 'operator', label: 'Operators' },
];

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
        :placeholder="`Search ${data.entries.length} keywords…`"
        aria-label="Search keywords"
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
          <th>Syntax</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="e in visible" :key="e.name">
          <td class="reftable-name">
            <code>{{ e.name }}</code>
            <span class="reftable-badge" :class="`kind-${e.kind}`">{{
              e.kind
            }}</span>
            <span v-if="e.tag" class="reftable-tag">{{ e.tag }}</span>
          </td>
          <td class="reftable-syntax">
            <code>{{ e.syntax }}</code>
          </td>
          <td class="reftable-desc">{{ e.description }}</td>
        </tr>
        <tr v-if="visible.length === 0">
          <td colspan="3" class="reftable-empty">
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
.reftable-name code,
.reftable-syntax code {
  white-space: nowrap;
}
.reftable-badge {
  display: inline-block;
  margin-left: 0.4rem;
  padding: 0 0.35rem;
  border-radius: 4px;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
}
.reftable-badge.kind-function {
  color: var(--vp-c-green-1);
}
.reftable-badge.kind-operator {
  color: var(--vp-c-yellow-1);
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
.reftable-desc {
  width: 50%;
}
.reftable-empty,
.reftable-count {
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
}
</style>
