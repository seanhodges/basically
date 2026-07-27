// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * A cheap fingerprint of the program a reply was written against.
 *
 * A generated fragment is a delta, not a self-contained answer: it says "line
 * 60 becomes this", which is only meaningful against the program the assistant
 * was shown. The user can edit or renumber between the reply arriving and
 * pressing Merge, so the fingerprint is recorded with the reply and compared at
 * apply time.
 *
 * Storing the source itself would double what an already program-heavy
 * conversation puts in localStorage, so this is a hash - FNV-1a, 32-bit. It is
 * not a security primitive: a collision means a stale fragment merges without a
 * warning, which is exactly today's behaviour.
 */
export function sourceFingerprint(source: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    // hash *= 16777619, kept in 32 bits without overflowing the mantissa.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
