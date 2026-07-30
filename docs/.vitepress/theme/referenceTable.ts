import type { KeywordDomain } from '../../reference/data/domains';
import type { ReferenceEntry } from '../../reference/data/types';

export type KindFilter = 'all' | ReferenceEntry['kind'];
export type DomainFilter = 'all' | KeywordDomain;
export type SortKey = 'name' | 'kind';
export type SortDir = 'asc' | 'desc';

/**
 * Case-insensitive substring match on name, plus the kind and capability-domain
 * filters. The three are AND-combined and orthogonal, so narrowing by one never
 * resets another. `domain` defaults to 'all', which is also what the two
 * assembly pages (whose entries carry no domain) always pass.
 */
export function filterEntries(
  entries: ReferenceEntry[],
  query: string,
  kind: KindFilter,
  domain: DomainFilter = 'all',
): ReferenceEntry[] {
  const q = query.trim().toLowerCase();
  return entries.filter((e) => {
    if (kind !== 'all' && e.kind !== kind) return false;
    if (domain !== 'all' && e.domain !== domain) return false;
    if (!q) return true;
    return e.name.toLowerCase().includes(q);
  });
}

/**
 * Resolve the row a `?name=` deep link targets: an exact, case-insensitive
 * match on the keyword name (trimmed). Returns `undefined` when the name is
 * blank or no row matches, so the caller can leave the page unhighlighted.
 */
export function findEntryByName(
  entries: ReferenceEntry[],
  name: string,
): ReferenceEntry | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  return entries.find((e) => e.name.toLowerCase() === n);
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
      key === 'kind'
        ? a.kind.localeCompare(b.kind)
        : a.name.localeCompare(b.name);
    if (primary !== 0) return primary * sign;
    return a.name.localeCompare(b.name) * sign;
  });
}
