import type { KeywordDomain } from '../../../src/reference/domains';
import type { ReferenceEntry } from '../../../src/reference/types';

// Row ordering lives with the data it orders (src/reference/sort.ts), because
// the comparison logic and the assistant's machine description order rows the
// same way. Re-exported here so this module stays the one place the reference
// page reaches for its table behaviour.
export { sortEntries } from '../../../src/reference/sort';
export type { SortDir, SortKey } from '../../../src/reference/sort';

export type KindFilter = 'all' | ReferenceEntry['kind'];
export type DomainFilter = 'all' | KeywordDomain;

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
