// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Fetching a machine's bundled ROM image, memoized per URL for the life of the
 * page.
 *
 * Extracted from `EmulatorPane` because two callers now need the same answer
 * and must not download the image twice: the pane, which runs it, and
 * {@link ../app/machineAvailability}, which asks whether it is there at all
 * before offering the machine in the picker. Sharing the cache means the
 * availability probe *is* the pane's later fetch.
 */

const romCache = new Map<string, Promise<Uint8Array>>();

/**
 * The bundled ROM at `url`.
 *
 * `expected` is the dialect's `romBytes` where it declares one, and checking it
 * is not belt-and-braces: an absent image does not reliably 404. A SPA host -
 * the Vite dev server included - answers an unknown path with `index.html` and
 * a 200, so a caller would otherwise be handed a page of HTML and fail deep
 * inside the machine's own boot with whatever that produced. The size check
 * turns that back into the fetch failure it really is.
 */
export function fetchRom(url: string, expected?: number): Promise<Uint8Array> {
  let cached = romCache.get(url);
  if (!cached) {
    const pending = fetch(url).then(async (r) => {
      if (!r.ok) throw new Error(`Failed to fetch ROM (${r.status})`);
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (expected !== undefined && bytes.length !== expected) {
        throw new Error(
          `Failed to fetch ROM (${bytes.length} bytes, expected ${expected})`,
        );
      }
      return bytes;
    });
    // Evict a rejection rather than memoizing it: the cache holds a promise, so
    // without this one offline miss would answer every later attempt for the
    // life of the page - including the fetch that "restore bundled ROM" needs.
    pending.catch(() => {
      if (romCache.get(url) === pending) romCache.delete(url);
    });
    cached = pending;
    romCache.set(url, cached);
  }
  return cached;
}
