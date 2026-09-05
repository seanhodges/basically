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
 * Case-insensitive substring match on the name *or* any of the keyword's short
 * spellings, plus the kind and capability-domain filters. The three are
 * AND-combined and orthogonal, so narrowing by one never resets another.
 * `domain` defaults to 'all', which is also what the two assembly pages (whose
 * entries carry no domain) always pass.
 *
 * Searching the spellings is what makes the page answer the question a reader
 * usually arrives with: they have `P.` or `?` in front of them in a listing and
 * want to know what it is. A spelling match is a prefix rather than a substring
 * - `P.` is a spelling of PRINT, and typing `.` should not return every dotted
 * keyword on the page.
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
    if (e.name.toLowerCase().includes(q)) return true;
    return (e.abbreviations ?? []).some((a) => a.toLowerCase().startsWith(q));
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
