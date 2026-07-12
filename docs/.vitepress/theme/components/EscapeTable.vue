<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { EscapeTableData } from '../../../reference/data/types';
import { filterEscapes, sortEscapes, type SortKey } from '../escapeTable';

const props = defineProps<{ data: EscapeTableData }>();

const query = ref('');
const category = ref('all');

// Seed the search and category filter from `?q=` / `?cat=` query params so
// pages (and the in-app docs drawer) can deep link to an escape or a group.
// Client-only, so SSG stays safe.
onMounted(() => {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q');
  if (q) query.value = q;
  const cat = params.get('cat');
  if (cat && props.data.categories.some((c) => c.id === cat)) {
    category.value = cat;
  }
});

// Byte order is the natural reading order for an escape table.
const sortKey = ref<SortKey>('bytes');
const sortDir = ref<'asc' | 'desc'>('asc');

const chips = computed(() => [
  { id: 'all', label: 'All' },
  ...props.data.categories,
]);

const visible = computed(() =>
  sortEscapes(
    filterEscapes(props.data.entries, query.value, category.value),
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
  <div class="esctable">
    <div class="esctable-controls">
      <input
        v-model="query"
        type="search"
        class="esctable-search"
        placeholder="Search escapes, descriptions or bytes…"
        aria-label="Search escapes, descriptions or bytes"
      />
      <div class="esctable-cats" role="group" aria-label="Filter by category">
        <button
          v-for="c in chips"
          :key="c.id"
          type="button"
          class="esctable-cat"
          :class="{ active: category === c.id }"
          @click="category = c.id"
        >
          {{ c.label }}
        </button>
      </div>
    </div>

    <table class="esctable-table">
      <thead>
        <tr>
          <th :aria-sort="ariaSort('escape')">
            <button
              type="button"
              class="esctable-sort"
              @click="toggleSort('escape')"
            >
              Escape
              <span v-if="sortKey === 'escape'">{{
                sortDir === 'asc' ? '▲' : '▼'
              }}</span>
            </button>
          </th>
          <th :aria-sort="ariaSort('bytes')">
            <button
              type="button"
              class="esctable-sort"
              @click="toggleSort('bytes')"
            >
              Bytes
              <span v-if="sortKey === 'bytes'">{{
                sortDir === 'asc' ? '▲' : '▼'
              }}</span>
            </button>
          </th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="e in visible" :key="e.escape">
          <td class="esctable-escape">
            <code>{{ e.escape }}</code>
            <span v-if="e.parseOnly" class="esctable-tag">parse-only</span>
            <span v-if="e.tag" class="esctable-tag">{{ e.tag }}</span>
            <div v-if="e.aliases && e.aliases.length" class="esctable-aliases">
              also:
              <code v-for="a in e.aliases" :key="a">{{ a }}</code>
            </div>
          </td>
          <td class="esctable-bytes">
            <code>{{ e.bytes }}</code>
          </td>
          <td class="esctable-desc">{{ e.description }}</td>
        </tr>
        <tr v-if="visible.length === 0">
          <td colspan="3" class="esctable-empty">
            No escapes match “{{ query }}”.
          </td>
        </tr>
      </tbody>
    </table>

    <p class="esctable-count">
      Showing {{ visible.length }} of {{ data.entries.length }} escape codes
    </p>
  </div>
</template>

<style scoped>
.esctable-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  margin: 1rem 0;
}
.esctable-search {
  flex: 1 1 16rem;
  padding: 0.45rem 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-size: 0.9rem;
}
.esctable-cats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.esctable-cat {
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
  cursor: pointer;
}
.esctable-cat.active {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  color: #fff;
}
.esctable-table {
  display: table;
  width: 100%;
  border-collapse: collapse;
}
.esctable-table th,
.esctable-table td {
  text-align: left;
  vertical-align: top;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--vp-c-divider);
}
.esctable-sort {
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  font-weight: 600;
  color: var(--vp-c-text-1);
  cursor: pointer;
}
.esctable-table th:first-child,
.esctable-escape,
.esctable-bytes {
  width: 1%;
  white-space: nowrap;
}
.esctable-escape code,
.esctable-bytes code {
  white-space: nowrap;
}
.esctable-aliases {
  margin-top: 0.15rem;
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
}
.esctable-aliases code {
  margin-left: 0.25rem;
}
.esctable-tag {
  display: inline-block;
  margin-left: 0.4rem;
  padding: 0 0.35rem;
  border-radius: 4px;
  font-size: 0.7rem;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}
.esctable-empty,
.esctable-count {
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
}
</style>
