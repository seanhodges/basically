import type { Dialect } from '../dialects/types';

/**
 * Docs sub-path for a dialect's reference page, optionally seeding the reference
 * table's search box with `selection`. Returns `null` when there's nothing to
 * search (the caller then falls back to the docs home).
 *
 * The first whitespace-delimited token of the selection is used, so a stray
 * trailing space or a two-word drag still resolves to a single keyword; the
 * table search is a case-insensitive substring match on the keyword name.
 */
export function referenceTopic(
  dialect: Dialect,
  selection: string,
): string | null {
  const keyword = selection.trim().split(/\s+/)[0] ?? '';
  if (!keyword) return null;
  const page = dialect.docsReference ?? dialect.id;
  return `reference/${page}?q=${encodeURIComponent(keyword)}`;
}
