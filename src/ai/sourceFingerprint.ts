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

/**
 * Whether the user has moved on from the program an answer was written against.
 *
 * The question every unrequested piece of work has to ask before it acts, since
 * all of it - a correction sent on its own, a check that takes over the
 * emulator - is work on a question the user may have already left behind.
 *
 * `writtenAgainst` is the program the assistant was answering about, never the
 * one that ran. A checked answer is by definition not what the editor holds, so
 * comparing the program that ran would report "moved on" every single time and
 * silently disable the lot.
 */
export function hasMovedOn(
  writtenAgainst: string,
  editorSource: string,
): boolean {
  return sourceFingerprint(writtenAgainst) !== sourceFingerprint(editorSource);
}
