// Row ordering for the reference tables. Shared rather than page-local: the
// comparison logic in ./compare.ts orders its buckets with it, and so does the
// machine description sent to the assistant, so "the order the rows come in" has
// to mean one thing. The reference page's own search box and `?name=` deep link
// stay in the docs theme (docs/.vitepress/theme/referenceTable.ts), which
// re-exports this - they are page state, not row order.
import type { ReferenceEntry } from './types';

export type SortKey = 'name' | 'kind';
export type SortDir = 'asc' | 'desc';

/** Stable sort by the chosen key; ties (and the `kind` key) fall back to name. Never mutates `entries`. */
export function sortEntries(
  entries: ReferenceEntry[],
  key: SortKey,
  dir: SortDir,
): ReferenceEntry[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...entries].sort((a, b) => {
    const primary =
      key === 'kind'
        ? a.kind.localeCompare(b.kind)
        : a.name.localeCompare(b.name);
    if (primary !== 0) return primary * sign;
    return a.name.localeCompare(b.name) * sign;
  });
}
