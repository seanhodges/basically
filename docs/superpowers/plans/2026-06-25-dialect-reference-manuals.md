# Dialect Reference Manuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive "Language reference" section to the VitePress docs site — one page per distinct BASIC dialect language set — where every command, function and operator is listed in a searchable, sortable, filterable table of `name | syntax | description`.

**Architecture:** A small scaffold generator reads each dialect's editor-facing keyword array (the `KeywordInfo[]` already exposed on every `Dialect`) and writes one draft data file per distinct language set under `docs/reference/data/`. Those data files are then hand-enriched (typed `<…>` syntax, fuller descriptions). A reusable, SSR-safe Vue component (`ReferenceTable.vue`) renders any data file with a search box, kind filter and sortable columns; its pure filter/sort logic lives in a separately unit-tested TypeScript module. One markdown page per set imports its data and drops in the component; the docs sidebar/nav gain a "Language reference" group.

**Tech Stack:** VitePress 1.6 (Vue 3, Vite 6), TypeScript (strict), Vitest 3, `vite-node` (bundled with Vitest) for the generator.

---

## Background: what already exists (read before starting)

- **The data source.** Every dialect exposes an editor-facing `keywords: KeywordInfo[]` on its `Dialect` object (`src/dialects/types.ts:206`). `KeywordInfo` (`src/dialects/types.ts:6`) is:
  ```ts
  interface KeywordInfo {
    word: string;                                  // canonical spelling, upper-case, e.g. "PRINT", "INKEY$", "**"
    token: number;
    kind: 'command' | 'function' | 'operator';
    signature?: string;                            // e.g. 'PRINT [AT row,col;] items', 'FOR v=a TO b [STEP c]'
    doc?: string;                                  // one-line description shown in autocomplete
  }
  ```
  `signature` and `doc` are populated for (almost) every keyword already — they are the raw material the generator copies into the draft, and the enrichment passes rewrite.

- **The distinct language sets.** The registry (`src/dialects/registry.ts`) currently registers nine dialects, but several share a keyword set, so there are **seven distinct language sets**. Each set's editor-facing array (the exact export name matters for the generator's imports):

  | Set id         | Page title                       | Machines covered (registry ids)   | Source array export                                              |
  | -------------- | -------------------------------- | --------------------------------- | --------------------------------------------------------------- |
  | `zx81`         | ZX81 BASIC                       | `zx81`                            | `zx81Keywords` — `src/dialects/zx81/keywords.ts`                |
  | `zx80`         | ZX80 integer BASIC               | `zx80`                            | `zx80Keywords` — `src/dialects/zx80/keywords.ts`               |
  | `zxspectrum`   | ZX Spectrum BASIC (48K & 128K)   | `zxspectrum`, `zxspectrum128`     | `spectrumKeywords` — `src/dialects/zxspectrum/keywords.ts` (+ `SPECTRUM_KEYWORD`, `PLAY_KEYWORD` from `src/dialects/zxspectrum128/keywords.ts`) |
  | `bbc`          | BBC BASIC (Micro & Master)       | `bbcmicro`, `bbcmaster`           | `bbcKeywords` — `src/dialects/bbcmicro/keywords.ts`            |
  | `commodore64`  | Commodore BASIC v2               | `commodore64`                     | `c64Keywords` — `src/dialects/commodore64/keywords.ts`         |
  | `atom`         | Acorn Atom BASIC                 | `atom`                            | `atomKeywords` — `src/dialects/atom/keywords.ts`               |
  | `trs80`        | TRS-80 Level II BASIC            | `trs80`                           | `trs80Keywords` — `src/dialects/trs80/keywords.ts`            |

  Notes that the enrichment must honour:
  - **Spectrum 128K** uses `spectrum128Keywords = [...spectrumKeywords, SPECTRUM_KEYWORD, PLAY_KEYWORD]` (`src/dialects/zxspectrum128/keywords.ts`). The Spectrum page covers both: those two extra commands are tagged `128K only`.
  - **BBC Master** reuses `bbcKeywords` wholesale (BASIC IV shares BASIC II's tokens), so the BBC page is one table; Master-specific behaviour is noted in prose, not extra rows.
  - These mappings reflect the registry **as it is today**. Per `CLAUDE.md`, don't hard-assume this list elsewhere — but for this plan the seven concrete sets above are the deliverable.

- **The docs site.** VitePress, rooted at `docs/`, base `/docs/`, config at `docs/.vitepress/config.ts`. Custom theme at `docs/.vitepress/theme/index.ts` (currently just re-exports `DefaultTheme` and imports `custom.css`). Dev/build/preview scripts already exist in `package.json`: `docs:dev`, `docs:build`, `docs:preview`. `basic` code fences are aliased to the `vb` grammar.

- **Test runner.** `vite.config.ts` sets `test.include: ['src/**/*.test.ts']`, `environment: 'node'`. Tests outside `src/` are **not** picked up until that glob is widened (done in Task 2).

- **Lint/format.** ESLint flat config (`eslint.config.js`) only lints `**/*.{ts,tsx}` and ignores `*.config.ts`; `.vue` files have no parser configured, so ESLint skips them — fine. Prettier formats `.ts`, `.md` and `.vue` by default. New `docs/**/*.ts` files **will** be type-checked by ESLint's recommended rules, so they must be clean.

### Column contract (the deliverable's shape)

Every table has exactly three visible data columns, per the requirement:

1. **Name** — the command/function/operator spelling, e.g. `INPUT`, `RND`, `<>`.
2. **Syntax** — a usage example with argument **types** in angle brackets, e.g. `INPUT [<string>;] <var>`, `MID$(<string>, <number> [, <number>])`.
3. **Description** — a brief explanation of what it does and how to use it, including notable behaviours where relevant.

`kind` is **not** a fourth column; it drives the kind filter and shows as a small inline badge next to the name.

### Syntax-notation convention (used by every enrichment pass)

Rewrite each raw `signature` into this notation so all seven pages read consistently:

| Token              | Meaning                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| `<number>`         | a numeric expression                                                    |
| `<string>`         | a string expression                                                     |
| `<var>`            | any variable (numeric or string) used as an assignment/read target      |
| `<numvar>` / `<strvar>` | a numeric / string variable specifically, when the keyword requires one |
| `<line>`           | a line number                                                           |
| `<int>`            | an integer constant/expression where only integers are valid            |
| `<channel>` / `<file>` | a stream/file/channel number (dialect-specific, e.g. C64 `#<file>`) |
| `[ … ]`            | optional part (keep existing bracket convention)                        |
| `…` or `,…`        | repeatable list                                                         |
| <code>&#124;</code> | alternatives                                                          |

Keep the canonical keyword spelling verbatim (including a trailing `$` or, where the dialect's editor view keeps it, a trailing `(`). Argument-less keywords (e.g. `PI`, `RND`, `END`) keep just the name as their syntax. Worked examples appear in each enrichment task.

---

## File structure (what this plan creates / modifies)

**Create:**
- `docs/reference/data/types.ts` — the `ReferenceEntry` / `ReferenceTableData` types.
- `docs/reference/data/zx81.ts`, `zx80.ts`, `zxspectrum.ts`, `bbc.ts`, `commodore64.ts`, `atom.ts`, `trs80.ts` — one data file per set (generated, then enriched).
- `docs/reference/data/reference-data.test.ts` — structural integrity test over all seven data files.
- `docs/.vitepress/theme/referenceTable.ts` — pure filter/sort logic.
- `docs/.vitepress/theme/referenceTable.test.ts` — unit tests for the logic.
- `docs/.vitepress/theme/components/ReferenceTable.vue` — the interactive table component.
- `docs/reference/index.md` — "Language reference" overview/landing page.
- `docs/reference/zx81.md`, `zx80.md`, `zxspectrum.md`, `bbc.md`, `commodore64.md`, `atom.md`, `trs80.md` — one page per set.
- `scripts/gen-reference-scaffold.mts` — the one-shot scaffold generator.

**Modify:**
- `vite.config.ts` — widen `test.include` to also match `docs/**/*.test.ts`.
- `package.json` — add the `gen:reference` script.
- `docs/.vitepress/theme/index.ts` — register `ReferenceTable` globally via `enhanceApp`.
- `docs/.vitepress/config.ts` — add the "Language reference" sidebar group and a nav entry.

---

## Task 1: Reference data model + scaffold generator

Produces the seven draft data files from the live keyword arrays. The generator is **create-only** (skips a file that already exists) so re-running it later for a brand-new dialect never clobbers enriched content.

**Files:**
- Create: `docs/reference/data/types.ts`
- Create: `scripts/gen-reference-scaffold.mts`
- Modify: `package.json` (add `gen:reference` script)
- Create (by running the generator): `docs/reference/data/{zx81,zx80,zxspectrum,bbc,commodore64,atom,trs80}.ts`

- [ ] **Step 1: Write the data-model types**

Create `docs/reference/data/types.ts`:

```ts
/** One row of a dialect reference table. */
export interface ReferenceEntry {
  /** Command/function/operator spelling as written, e.g. "INPUT", "MID$", "<>". */
  name: string;
  kind: 'command' | 'function' | 'operator';
  /** Usage example with typed arguments, e.g. "INPUT [<string>;] <var>". */
  syntax: string;
  /** Brief description, including notable behaviours where relevant. */
  description: string;
  /** Optional badge, e.g. "128K only" or "Master only". */
  tag?: string;
}

/** Everything one reference page renders. */
export interface ReferenceTableData {
  /** Page/table title, e.g. "ZX Spectrum BASIC (48K & 128K)". */
  title: string;
  /** Machines this language set covers, for the page intro. */
  machines: string[];
  entries: ReferenceEntry[];
}
```

- [ ] **Step 2: Write the scaffold generator**

Create `scripts/gen-reference-scaffold.mts`. It imports each set's editor-facing array directly (those modules only import the type-only `../types`, so they are side-effect-free and safe to load under `vite-node`), normalises to `ReferenceEntry` drafts (copying `signature`→`syntax`, `doc`→`description`), de-duplicates by name, and writes each file only if absent.

```ts
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { KeywordInfo } from '../src/dialects/types';
import type { ReferenceEntry, ReferenceTableData } from '../docs/reference/data/types';

import { zx81Keywords } from '../src/dialects/zx81/keywords';
import { zx80Keywords } from '../src/dialects/zx80/keywords';
import { spectrumKeywords } from '../src/dialects/zxspectrum/keywords';
import {
  SPECTRUM_KEYWORD,
  PLAY_KEYWORD,
} from '../src/dialects/zxspectrum128/keywords';
import { bbcKeywords } from '../src/dialects/bbcmicro/keywords';
import { c64Keywords } from '../src/dialects/commodore64/keywords';
import { atomKeywords } from '../src/dialects/atom/keywords';
import { trs80Keywords } from '../src/dialects/trs80/keywords';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '../docs/reference/data');

/** Copy a keyword into a draft row; the enrichment passes rewrite syntax/description. */
function toEntry(k: KeywordInfo, tag?: string): ReferenceEntry {
  return {
    name: k.word,
    kind: k.kind,
    syntax: k.signature ?? k.word,
    description: k.doc ?? '',
    ...(tag ? { tag } : {}),
  };
}

/** De-duplicate by name (some dialects list aliases), keeping the first occurrence. */
function dedupe(entries: ReferenceEntry[]): ReferenceEntry[] {
  const seen = new Set<string>();
  return entries.filter((e) => (seen.has(e.name) ? false : seen.add(e.name)));
}

const sets: { id: string; varName: string; data: ReferenceTableData }[] = [
  {
    id: 'zx81',
    varName: 'zx81Reference',
    data: {
      title: 'ZX81 BASIC',
      machines: ['Sinclair ZX81'],
      entries: dedupe(zx81Keywords.map((k) => toEntry(k))),
    },
  },
  {
    id: 'zx80',
    varName: 'zx80Reference',
    data: {
      title: 'ZX80 integer BASIC',
      machines: ['Sinclair ZX80'],
      entries: dedupe(zx80Keywords.map((k) => toEntry(k))),
    },
  },
  {
    id: 'zxspectrum',
    varName: 'zxspectrumReference',
    data: {
      title: 'ZX Spectrum BASIC (48K & 128K)',
      machines: ['Sinclair ZX Spectrum 48K', 'Sinclair ZX Spectrum 128K'],
      entries: dedupe([
        ...spectrumKeywords.map((k) => toEntry(k)),
        toEntry(SPECTRUM_KEYWORD, '128K only'),
        toEntry(PLAY_KEYWORD, '128K only'),
      ]),
    },
  },
  {
    id: 'bbc',
    varName: 'bbcReference',
    data: {
      title: 'BBC BASIC (Micro & Master)',
      machines: ['BBC Micro Model B', 'BBC Master'],
      entries: dedupe(bbcKeywords.map((k) => toEntry(k))),
    },
  },
  {
    id: 'commodore64',
    varName: 'commodore64Reference',
    data: {
      title: 'Commodore BASIC v2',
      machines: ['Commodore 64'],
      entries: dedupe(c64Keywords.map((k) => toEntry(k))),
    },
  },
  {
    id: 'atom',
    varName: 'atomReference',
    data: {
      title: 'Acorn Atom BASIC',
      machines: ['Acorn Atom'],
      entries: dedupe(atomKeywords.map((k) => toEntry(k))),
    },
  },
  {
    id: 'trs80',
    varName: 'trs80Reference',
    data: {
      title: 'TRS-80 Level II BASIC',
      machines: ['TRS-80 Model I (Level II BASIC)'],
      entries: dedupe(trs80Keywords.map((k) => toEntry(k))),
    },
  },
];

mkdirSync(dataDir, { recursive: true });

for (const { id, varName, data } of sets) {
  const file = resolve(dataDir, `${id}.ts`);
  if (existsSync(file)) {
    console.log(`skip (exists): docs/reference/data/${id}.ts`);
    continue;
  }
  const body =
    `// Reference table data for the ${data.title} page.\n` +
    `// Seeded from the dialect's keyword table by scripts/gen-reference-scaffold.mts,\n` +
    `// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;\n` +
    `// the generator skips this file once it exists.\n` +
    `import type { ReferenceTableData } from './types';\n\n` +
    `export const ${varName}: ReferenceTableData = ${JSON.stringify(data, null, 2)};\n`;
  writeFileSync(file, body, 'utf8');
  console.log(`wrote docs/reference/data/${id}.ts (${data.entries.length} entries)`);
}
```

- [ ] **Step 3: Add the `gen:reference` npm script**

In `package.json`, inside `"scripts"`, after the `"docs:preview"` line, add:

```json
    "gen:reference": "vite-node scripts/gen-reference-scaffold.mts",
```

(Ensure the preceding line keeps its trailing comma and the JSON stays valid.)

- [ ] **Step 4: Run the generator**

Run: `npm run gen:reference`
Expected: seven `wrote docs/reference/data/<id>.ts (<n> entries)` lines, no errors. (If a data file already exists you'll see `skip (exists): …` — for the first run none should exist.)

- [ ] **Step 5: Format and type-check the generated files**

Run: `npm run format` then `npm run typecheck`
Expected: Prettier rewrites the new files in place; `tsc -b` exits 0. The generator output is valid TypeScript, so typecheck passes.

- [ ] **Step 6: Commit**

```bash
git add docs/reference/data scripts/gen-reference-scaffold.mts package.json
git commit -m "docs: scaffold dialect reference data from keyword tables"
```

---

## Task 2: Pure filter/sort logic (TDD)

The interactive behaviour (search, kind filter, column sort) lives in a pure module so it can be unit-tested under Vitest without a Vue test harness. The `.vue` component (Task 3) is a thin shell over these functions.

**Files:**
- Modify: `vite.config.ts` (widen `test.include`)
- Create: `docs/.vitepress/theme/referenceTable.ts`
- Test: `docs/.vitepress/theme/referenceTable.test.ts`

- [ ] **Step 1: Widen the Vitest include glob**

In `vite.config.ts`, change:

```ts
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
```

to:

```ts
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'docs/**/*.test.ts'],
  },
```

- [ ] **Step 2: Write the failing test**

Create `docs/.vitepress/theme/referenceTable.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ReferenceEntry } from '../../reference/data/types';
import { filterEntries, sortEntries } from './referenceTable';

const ENTRIES: ReferenceEntry[] = [
  { name: 'PRINT', kind: 'command', syntax: 'PRINT [<expr>…]', description: 'Write to the screen.' },
  { name: 'INPUT', kind: 'command', syntax: 'INPUT [<string>;] <var>', description: 'Read from the keyboard.' },
  { name: 'RND', kind: 'function', syntax: 'RND', description: 'Random number.' },
  { name: 'AND', kind: 'operator', syntax: '<number> AND <number>', description: 'Bitwise AND.' },
];

describe('filterEntries', () => {
  it('returns everything when query is empty and kind is "all"', () => {
    expect(filterEntries(ENTRIES, '', 'all')).toHaveLength(4);
  });

  it('matches name, syntax and description case-insensitively', () => {
    expect(filterEntries(ENTRIES, 'keyboard', 'all').map((e) => e.name)).toEqual(['INPUT']);
    expect(filterEntries(ENTRIES, 'rnd', 'all').map((e) => e.name)).toEqual(['RND']);
    expect(filterEntries(ENTRIES, '<string>', 'all').map((e) => e.name)).toEqual(['INPUT']);
  });

  it('filters by kind', () => {
    expect(filterEntries(ENTRIES, '', 'function').map((e) => e.name)).toEqual(['RND']);
    expect(filterEntries(ENTRIES, '', 'operator').map((e) => e.name)).toEqual(['AND']);
  });

  it('combines query and kind', () => {
    expect(filterEntries(ENTRIES, 'p', 'command').map((e) => e.name)).toEqual(['PRINT', 'INPUT']);
  });
});

describe('sortEntries', () => {
  it('sorts by name ascending and descending without mutating the input', () => {
    const asc = sortEntries(ENTRIES, 'name', 'asc').map((e) => e.name);
    expect(asc).toEqual(['AND', 'INPUT', 'PRINT', 'RND']);
    const desc = sortEntries(ENTRIES, 'name', 'desc').map((e) => e.name);
    expect(desc).toEqual(['RND', 'PRINT', 'INPUT', 'AND']);
    expect(ENTRIES[0].name).toBe('PRINT'); // original order untouched
  });

  it('sorts by kind, breaking ties by name', () => {
    const byKind = sortEntries(ENTRIES, 'kind', 'asc').map((e) => `${e.kind}:${e.name}`);
    expect(byKind).toEqual(['command:INPUT', 'command:PRINT', 'function:RND', 'operator:AND']);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run docs/.vitepress/theme/referenceTable.test.ts`
Expected: FAIL — cannot resolve `./referenceTable` (module not yet created).

- [ ] **Step 4: Write the implementation**

Create `docs/.vitepress/theme/referenceTable.ts`:

```ts
import type { ReferenceEntry } from '../../reference/data/types';

export type KindFilter = 'all' | ReferenceEntry['kind'];
export type SortKey = 'name' | 'kind';
export type SortDir = 'asc' | 'desc';

/** Case-insensitive substring match across name, syntax and description, plus kind filter. */
export function filterEntries(
  entries: ReferenceEntry[],
  query: string,
  kind: KindFilter,
): ReferenceEntry[] {
  const q = query.trim().toLowerCase();
  return entries.filter((e) => {
    if (kind !== 'all' && e.kind !== kind) return false;
    if (!q) return true;
    return (
      e.name.toLowerCase().includes(q) ||
      e.syntax.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q)
    );
  });
}

/** Stable sort by the chosen key; ties (and the `kind` key) fall back to name. Never mutates `entries`. */
export function sortEntries(
  entries: ReferenceEntry[],
  key: SortKey,
  dir: SortDir,
): ReferenceEntry[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...entries].sort((a, b) => {
    const primary =
      key === 'kind' ? a.kind.localeCompare(b.kind) : a.name.localeCompare(b.name);
    if (primary !== 0) return primary * sign;
    return a.name.localeCompare(b.name) * sign;
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run docs/.vitepress/theme/referenceTable.test.ts`
Expected: PASS (all assertions green).

- [ ] **Step 6: Confirm the wider glob didn't disturb the existing suite**

Run: `npm test`
Expected: the full suite passes, now including the new `docs/**` test.

- [ ] **Step 7: Commit**

```bash
git add vite.config.ts docs/.vitepress/theme/referenceTable.ts docs/.vitepress/theme/referenceTable.test.ts
git commit -m "docs: add tested filter/sort logic for the reference table"
```

---

## Task 3: Interactive ReferenceTable component

A self-contained, SSR-safe Vue SFC that renders any `ReferenceTableData` with a search box, kind filter, sortable Name/Kind columns, and a live result count. Registered globally so markdown pages can use `<ReferenceTable :data="…" />`.

**Files:**
- Create: `docs/.vitepress/theme/components/ReferenceTable.vue`
- Modify: `docs/.vitepress/theme/index.ts`

- [ ] **Step 1: Write the component**

Create `docs/.vitepress/theme/components/ReferenceTable.vue`:

```vue
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
            <button type="button" class="reftable-sort" @click="toggleSort('name')">
              Name
              <span v-if="sortKey === 'name'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
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
            <span class="reftable-badge" :class="`kind-${e.kind}`">{{ e.kind }}</span>
            <span v-if="e.tag" class="reftable-tag">{{ e.tag }}</span>
          </td>
          <td class="reftable-syntax"><code>{{ e.syntax }}</code></td>
          <td class="reftable-desc">{{ e.description }}</td>
        </tr>
        <tr v-if="visible.length === 0">
          <td colspan="3" class="reftable-empty">No keywords match “{{ query }}”.</td>
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
.reftable-badge.kind-function { color: var(--vp-c-green-1); }
.reftable-badge.kind-operator { color: var(--vp-c-yellow-1); }
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
```

- [ ] **Step 2: Register the component globally**

Replace the contents of `docs/.vitepress/theme/index.ts` with:

```ts
import DefaultTheme from 'vitepress/theme';
import ReferenceTable from './components/ReferenceTable.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ReferenceTable', ReferenceTable);
  },
};
```

- [ ] **Step 3: Verify the docs build compiles the component**

Run: `npm run docs:build`
Expected: build completes (`build complete` / writes to `dist/docs`) with no Vue compile or type errors. (No reference pages use the component yet — this step just proves the SFC and registration compile.)

- [ ] **Step 4: Commit**

```bash
git add docs/.vitepress/theme/components/ReferenceTable.vue docs/.vitepress/theme/index.ts
git commit -m "docs: add interactive ReferenceTable component"
```

---

## Tasks 4a–4g: Enrich each set's data file

One task per data file. Each pass walks **every** entry and:
1. Rewrites `syntax` into the typed `<…>` notation (see the convention table above).
2. Expands `description` from the terse autocomplete one-liner into a brief but useful explanation, calling out notable behaviours (range limits, side effects, gotchas).
3. Leaves `name`/`kind`/`tag` untouched.

Pull supporting detail from the dialect's `aiProfile.ts` (machine quirks, memory notes) and `docs/guide/writing-basic.md`. Keep descriptions to roughly one or two sentences. After editing each file, run `npm run typecheck` (catches a broken object/quote) before committing.

> The worked rows below are **mandatory examples of the target quality**, not the full list — apply the same treatment to every entry in the file.

- [ ] **Task 4a — `docs/reference/data/zx81.ts`** (source quirks in `src/dialects/zx81/aiProfile.ts`; note FAST/SLOW display, single-letter variables, one statement per line). Examples:

  ```ts
  { name: 'PRINT', kind: 'command', syntax: 'PRINT [AT <number>,<number>;] [<expr>][;|,]…',
    description: 'Writes text and numbers to the display. "," tabs to the next 16-column field; ";" joins items with no gap; a trailing ";" suppresses the newline. PRINT AT positions the cursor at row 0–21, column 0–31.' },
  { name: 'INPUT', kind: 'command', syntax: 'INPUT <var>',
    description: 'Stops and waits for the user to type a value, assigning it to the variable. Halts the program, so use INKEY$ in real-time game loops instead.' },
  { name: 'RND', kind: 'function', syntax: 'RND',
    description: 'Returns a pseudo-random number in [0,1). Seed the generator with RAND; RAND 0 seeds from the frame counter for unpredictable results.' },
  { name: 'SLOW', kind: 'command', syntax: 'SLOW',
    description: 'Switches to SLOW mode: the display stays on continuously but the CPU runs at about a quarter speed. FAST blanks the screen for full-speed computation.' },
  ```
  Run: `npm run typecheck` → exit 0, then commit:
  ```bash
  git add docs/reference/data/zx81.ts
  git commit -m "docs: enrich ZX81 reference entries"
  ```

- [ ] **Task 4b — `docs/reference/data/zx80.ts`** (integer-only BASIC; per `docs/dialect-roadmap.md` and `src/dialects/zx80/aiProfile.ts`, several functions exist but the assistant is told to avoid the untokenized ones — keep descriptions honest about integer-only arithmetic). Example:

  ```ts
  { name: 'PRINT', kind: 'command', syntax: 'PRINT [<expr>][;|,]…',
    description: 'Writes to the display. ZX80 BASIC is integer-only, so numeric values print without a fractional part.' },
  ```
  Run: `npm run typecheck`, then:
  ```bash
  git add docs/reference/data/zx80.ts
  git commit -m "docs: enrich ZX80 reference entries"
  ```

- [ ] **Task 4c — `docs/reference/data/zxspectrum.ts`** (source quirks in `src/dialects/zxspectrum/aiProfile.ts`; keep the `128K only` tags on SPECTRUM and PLAY and explain them). Examples:

  ```ts
  { name: 'MID$', kind: 'function', syntax: 'MID$(<string>, <number> [, <number>])',
    description: 'Returns a substring starting at the given position (1-based) for the given length; the length defaults to the rest of the string.' },
  { name: 'PLAY', kind: 'command', syntax: 'PLAY <string>[, <string>…]', tag: '128K only',
    description: 'Plays music strings on the AY-3-8912 sound chip, one string per channel. Only available in 128K mode.' },
  { name: 'SPECTRUM', kind: 'command', syntax: 'SPECTRUM', tag: '128K only',
    description: 'Switches the machine back to 48 BASIC. Only meaningful on the 128K models.' },
  ```
  Run: `npm run typecheck`, then:
  ```bash
  git add docs/reference/data/zxspectrum.ts
  git commit -m "docs: enrich ZX Spectrum reference entries"
  ```

- [ ] **Task 4d — `docs/reference/data/bbc.ts`** (source quirks in `src/dialects/bbcmicro/aiProfile.ts`; note Master/BASIC IV behaviour in prose where it differs, e.g. extra MODE numbers). Examples:

  ```ts
  { name: 'MODE', kind: 'command', syntax: 'MODE <number>',
    description: 'Selects a screen mode (0–7 on the Micro), clearing the screen and resetting graphics. Different modes trade resolution and colours against memory.' },
  { name: 'GCOL', kind: 'command', syntax: 'GCOL <number>, <number>',
    description: 'Sets the graphics foreground/background colour and plot action (the first argument is the plot mode, the second the logical colour). Use COLOUR for text.' },
  { name: 'AND', kind: 'operator', syntax: '<number> AND <number>',
    description: 'Bitwise/logical AND of two integers.' },
  ```
  Run: `npm run typecheck`, then:
  ```bash
  git add docs/reference/data/bbc.ts
  git commit -m "docs: enrich BBC BASIC reference entries"
  ```

- [ ] **Task 4e — `docs/reference/data/commodore64.ts`** (source quirks in `src/dialects/commodore64/aiProfile.ts`; note there are no graphics keywords — graphics are via POKE to VIC-II; keep print-formatter names like `TAB(`/`SPC(` verbatim). Examples:

  ```ts
  { name: 'POKE', kind: 'command', syntax: 'POKE <number>, <number>',
    description: 'Writes a byte (0–255) to a memory address (0–65535). The C64 has no graphics keywords, so screen, colour and sprite effects are done by POKEing VIC-II registers.' },
  { name: 'INPUT', kind: 'command', syntax: 'INPUT [<string>;] <var>[, <var>…]',
    description: 'Prints the optional prompt then reads one or more comma-separated values from the keyboard into the variables.' },
  { name: 'MID$', kind: 'function', syntax: 'MID$(<string>, <number> [, <number>])',
    description: 'Returns a substring starting at the 1-based position for the optional length (default: to the end of the string).' },
  ```
  Run: `npm run typecheck`, then:
  ```bash
  git add docs/reference/data/commodore64.ts
  git commit -m "docs: enrich Commodore 64 reference entries"
  ```

- [ ] **Task 4f — `docs/reference/data/atom.ts`** (source quirks in `src/dialects/atom/aiProfile.ts`; Atom BASIC has integer variables A–Z, the `?`/`!` memory operators, and `$` string handling — describe these honestly). Example:

  ```ts
  { name: 'DO', kind: 'command', syntax: 'DO … UNTIL <number>',
    description: 'Begins a loop whose body repeats until the UNTIL condition is true (tested at the bottom, so the body always runs at least once).' },
  ```
  Run: `npm run typecheck`, then:
  ```bash
  git add docs/reference/data/atom.ts
  git commit -m "docs: enrich Acorn Atom reference entries"
  ```

- [ ] **Task 4g — `docs/reference/data/trs80.ts`** (source quirks in `src/dialects/trs80/aiProfile.ts`; Microsoft Level II BASIC, 64×16 display, SET/RESET/POINT block graphics). Examples:

  ```ts
  { name: 'SET', kind: 'command', syntax: 'SET(<number>, <number>)',
    description: 'Lights the block-graphics cell at (x, y) — x 0–127, y 0–47 on the 64×16 character display. RESET clears it; POINT tests it.' },
  { name: 'PRINT', kind: 'command', syntax: 'PRINT [@ <number>,] [<expr>][;|,]…',
    description: 'Writes to the screen; "PRINT @ n," positions output at screen cell n (0–1023). "," advances to the next print zone, ";" joins items.' },
  ```
  Run: `npm run typecheck`, then:
  ```bash
  git add docs/reference/data/trs80.ts
  git commit -m "docs: enrich TRS-80 reference entries"
  ```

---

## Task 5: Reference pages + sidebar/nav wiring

Add one markdown page per set, an overview page, and the navigation entries.

**Files:**
- Create: `docs/reference/index.md`
- Create: `docs/reference/{zx81,zx80,zxspectrum,bbc,commodore64,atom,trs80}.md`
- Modify: `docs/.vitepress/config.ts`

- [ ] **Step 1: Create the overview page**

Create `docs/reference/index.md`:

```md
---
title: Language reference
---

# Language reference

Searchable, sortable tables of every command, function and operator in each BASIC
dialect Basically supports. Use the search box to filter by name, syntax or
description, the buttons to narrow by kind, and the **Name** / **Kind** headers to
re-sort.

- [ZX81 BASIC](./zx81)
- [ZX80 integer BASIC](./zx80)
- [ZX Spectrum BASIC (48K & 128K)](./zxspectrum)
- [BBC BASIC (Micro & Master)](./bbc)
- [Commodore BASIC v2](./commodore64)
- [Acorn Atom BASIC](./atom)
- [TRS-80 Level II BASIC](./trs80)
```

- [ ] **Step 2: Create the seven dialect pages**

Each page imports its data file and renders the component. Create `docs/reference/zx81.md`:

```md
---
title: ZX81 BASIC reference
---

<script setup>
import { zx81Reference } from './data/zx81';
</script>

# ZX81 BASIC reference

Every command, function and operator in Sinclair ZX81 BASIC.

<ReferenceTable :data="zx81Reference" />
```

Create the other six the same way, substituting the heading, intro sentence, import name and data path:

| File                              | Import statement                                             | Heading                          |
| --------------------------------- | ----------------------------------------------------------- | -------------------------------- |
| `docs/reference/zx80.md`          | `import { zx80Reference } from './data/zx80';`              | `# ZX80 BASIC reference`         |
| `docs/reference/zxspectrum.md`    | `import { zxspectrumReference } from './data/zxspectrum';`  | `# ZX Spectrum BASIC reference`  |
| `docs/reference/bbc.md`           | `import { bbcReference } from './data/bbc';`                | `# BBC BASIC reference`          |
| `docs/reference/commodore64.md`   | `import { commodore64Reference } from './data/commodore64';`| `# Commodore BASIC v2 reference` |
| `docs/reference/atom.md`          | `import { atomReference } from './data/atom';`              | `# Acorn Atom BASIC reference`   |
| `docs/reference/trs80.md`         | `import { trs80Reference } from './data/trs80';`            | `# TRS-80 Level II BASIC reference` |

Each page's `<ReferenceTable :data="…" />` uses the matching import name (e.g. `:data="bbcReference"`).

- [ ] **Step 3: Add the sidebar group and nav entry**

In `docs/.vitepress/config.ts`, add a new sidebar group. Insert this object into the `sidebar` array, after the existing `Reference` group (before `Contributing`):

```ts
        {
          text: 'Language reference',
          items: [
            { text: 'Overview', link: '/reference/' },
            { text: 'ZX81 BASIC', link: '/reference/zx81' },
            { text: 'ZX80 integer BASIC', link: '/reference/zx80' },
            { text: 'ZX Spectrum BASIC', link: '/reference/zxspectrum' },
            { text: 'BBC BASIC', link: '/reference/bbc' },
            { text: 'Commodore BASIC v2', link: '/reference/commodore64' },
            { text: 'Acorn Atom BASIC', link: '/reference/atom' },
            { text: 'TRS-80 Level II BASIC', link: '/reference/trs80' },
          ],
        },
```

And add a top nav item — change the existing `nav` `Reference` entry's target to the new overview, or add a sibling. Add this object to the `nav` array after the `Reference` entry:

```ts
        { text: 'Languages', link: '/reference/' },
```

- [ ] **Step 4: Build the docs and check for dead links**

Run: `npm run docs:build`
Expected: build completes with no dead-link errors and no Vue/TS compile errors. (VitePress fails the build on dead internal links; the new pages and sidebar links must all resolve.)

- [ ] **Step 5: Visual check in the dev server**

Run: `npm run docs:dev` and open `http://localhost:5173/docs/reference/zx81` (or the port VitePress prints).
Verify by eye: the table renders; typing in the search box filters rows live; the kind buttons narrow the list; clicking **Name** / **Kind** re-sorts and toggles direction; the result count updates; the `128K only` tags show on the Spectrum page's PLAY/SPECTRUM rows. Stop the dev server when done.

- [ ] **Step 6: Commit**

```bash
git add docs/reference/index.md docs/reference/zx81.md docs/reference/zx80.md docs/reference/zxspectrum.md docs/reference/bbc.md docs/reference/commodore64.md docs/reference/atom.md docs/reference/trs80.md docs/.vitepress/config.ts
git commit -m "docs: add language reference pages and navigation"
```

---

## Task 6: Data-integrity test + final verification

A structural test guards every data file against regressions (missing fields, bad kinds, duplicate names, empty syntax/description), then a full verification sweep.

**Files:**
- Create: `docs/reference/data/reference-data.test.ts`

- [ ] **Step 1: Write the integrity test**

Create `docs/reference/data/reference-data.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ReferenceTableData } from './types';
import { zx81Reference } from './zx81';
import { zx80Reference } from './zx80';
import { zxspectrumReference } from './zxspectrum';
import { bbcReference } from './bbc';
import { commodore64Reference } from './commodore64';
import { atomReference } from './atom';
import { trs80Reference } from './trs80';

const SETS: [string, ReferenceTableData][] = [
  ['zx81', zx81Reference],
  ['zx80', zx80Reference],
  ['zxspectrum', zxspectrumReference],
  ['bbc', bbcReference],
  ['commodore64', commodore64Reference],
  ['atom', atomReference],
  ['trs80', trs80Reference],
];

describe.each(SETS)('reference data: %s', (_id, data) => {
  it('has a title, machine list and entries', () => {
    expect(data.title).toBeTruthy();
    expect(data.machines.length).toBeGreaterThan(0);
    expect(data.entries.length).toBeGreaterThan(0);
  });

  it('every entry is structurally complete', () => {
    for (const e of data.entries) {
      expect(e.name, 'name').toBeTruthy();
      expect(['command', 'function', 'operator']).toContain(e.kind);
      expect(e.syntax, `syntax for ${e.name}`).toBeTruthy();
      expect(e.description.length, `description for ${e.name}`).toBeGreaterThan(0);
    }
  });

  it('has no duplicate names', () => {
    const names = data.entries.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
```

- [ ] **Step 2: Run the integrity test**

Run: `npx vitest run docs/reference/data/reference-data.test.ts`
Expected: PASS. If a description is still empty (a keyword whose source `doc` was absent), the test fails and points at the entry — fill it in during enrichment and re-run.

- [ ] **Step 3: Full verification sweep**

Run each and confirm a clean result:
- `npm run typecheck` → exit 0
- `npm test` → all suites pass (includes the two new `docs/**` test files)
- `npm run lint` → no errors
- `npm run format:check` → no formatting diffs (run `npm run format` first if needed)
- `npm run docs:build` → build completes, no dead links

- [ ] **Step 4: Commit**

```bash
git add docs/reference/data/reference-data.test.ts
git commit -m "docs: add reference data integrity test"
```

---

## Self-review (performed while writing this plan)

- **Spec coverage.** One page per distinct language set (Task 5) ✓. Three columns — name, typed-syntax example, behavioural description (column contract + enrichment Tasks 4a–4g) ✓. Interactive table — search, kind filter, sortable columns, live count (Task 3) ✓. "All available commands/functions/operations" — every `KeywordInfo` is copied by the generator and the integrity test forbids dropping fields (Tasks 1, 6) ✓.
- **Placeholder scan.** Enrichment tasks intentionally show representative rows rather than all ~600, but each gives the exact notation, the source of supporting detail (`aiProfile.ts`), worked examples at target quality, and a per-file verify+commit — so an executor has a concrete, repeatable procedure, not a vague "fill in details". No `TODO`/"handle edge cases"/"similar to above" placeholders remain in code steps.
- **Type consistency.** `ReferenceEntry`/`ReferenceTableData` are defined once (Task 1) and imported everywhere (generator, logic, component, tests). Export names (`zx81Reference` … `trs80Reference`) are used identically in the generator, the markdown pages and both test files. `filterEntries`/`sortEntries` signatures match between the test (Task 2 Step 2), the implementation (Step 4) and the component (Task 3).
- **Decisions captured.** Hybrid generate-then-enrich, VitePress + interactive Vue component, one page per distinct language set (Spectrum 48K/128K merged with `128K only` tags; BBC Micro/Master merged) — as agreed.
```
