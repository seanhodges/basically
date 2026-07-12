import type { EscapeEntry } from '../../reference/data/types';

export type SortKey = 'bytes' | 'escape';
export type SortDir = 'asc' | 'desc';

/**
 * Case-insensitive substring match over the escape spelling, description,
 * aliases and the human-readable bytes column, plus the category filter.
 * Hex/byte queries are normalised (`0x93`, `$93` and `93` all match a row
 * whose bytes column says `0x93`), so the in-app docs drawer can deep-link
 * a byte value as well as a name.
 */
export function filterEscapes(
  entries: EscapeEntry[],
  query: string,
  category: string,
): EscapeEntry[] {
  const q = query.trim().toLowerCase();
  const qByte = q.replace(/^(0x|\$)/, '');
  return entries.filter((e) => {
    if (category !== 'all' && e.category !== category) return false;
    if (!q) return true;
    const haystack = [e.escape, e.description, ...(e.aliases ?? [])]
      .join(' ')
      .toLowerCase();
    if (haystack.includes(q)) return true;
    const bytes = e.bytes.toLowerCase();
    return bytes.includes(q) || bytes.replace(/0x/g, '').includes(qByte);
  });
}

/**
 * Stable sort by the chosen key; never mutates `entries`. `bytes` sorts
 * numerically by the first example byte (the natural reading order for an
 * escape table), `escape` lexically; ties fall back to the other key.
 */
export function sortEscapes(
  entries: EscapeEntry[],
  key: SortKey,
  dir: SortDir,
): EscapeEntry[] {
  const sign = dir === 'asc' ? 1 : -1;
  const byByte = (a: EscapeEntry, b: EscapeEntry) =>
    (a.example.bytes[0] ?? 0) - (b.example.bytes[0] ?? 0);
  const byEscape = (a: EscapeEntry, b: EscapeEntry) =>
    a.escape.localeCompare(b.escape);
  return [...entries].sort((a, b) => {
    const primary = key === 'bytes' ? byByte(a, b) : byEscape(a, b);
    if (primary !== 0) return primary * sign;
    const secondary = key === 'bytes' ? byEscape(a, b) : byByte(a, b);
    return secondary * sign;
  });
}
