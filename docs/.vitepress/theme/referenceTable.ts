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
