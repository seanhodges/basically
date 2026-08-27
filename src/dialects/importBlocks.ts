// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Turn code files recovered from a native binary import into
 * {@link Block}s. Shared across dialects (Spectrum `.TAP` CODE files,
 * TRS-80 SYSTEM `.cas` records, Commodore `.d64` entries…) - the conversion
 * has nothing dialect-specific in it.
 *
 * The one thing this module exists to get right: a native tape/disc header
 * name is arbitrary machine text - routinely blank, digit-led, containing
 * spaces, or punctuation - but {@link Block.name} must match
 * `/^[A-Za-z][A-Za-z0-9_]*$/` and be unique per document (see
 * `src/storage/projectFile.ts`'s `isValidBlockName`/`findDuplicateBlockName`,
 * which the Run-path lint gate enforces). Passing a raw header name
 * through would silently produce a block the user can never Run.
 */

import type { Block } from './types';

/**
 * A code payload recovered from an imported binary, in the minimal structural
 * shape every dialect's parser can produce: the Spectrum's `CodeFile` matches
 * it as-is; other dialects add `entry` when their format carries an execution
 * entry address alongside the payload.
 */
export interface ImportedCodeFile {
  name: string;
  address: number;
  bytes: Uint8Array;
  /** Execution entry address, when the format records one (see {@link Block.entry}). */
  entry?: number;
}

const INVALID_NAME_CHARS = /[^A-Za-z0-9_]/g;

/**
 * Sanitize `raw` (a decoded `.TAP` header name) into a name matching
 * `/^[A-Za-z][A-Za-z0-9_]*$/`: disallowed characters become `_`, and a result
 * that doesn't start with a letter (empty, all-whitespace, or leading digit)
 * falls back to `fallback` - or, for a leading digit, is prefixed with `b_`
 * so the original digits are still visible in the name. `fallback` must
 * itself already be a valid name (callers pass a generated `code<N>`).
 */
export function sanitizeBlockName(raw: string, fallback: string): string {
  const cleaned = raw.trim().replace(INVALID_NAME_CHARS, '_');
  if (cleaned === '') return fallback;
  if (/^[A-Za-z]/.test(cleaned)) return cleaned;
  return `b_${cleaned}`;
}

/**
 * Sanitize a whole set of header names (see {@link sanitizeBlockName}) and
 * make them unique within the set - two CODE files sharing a header name (or
 * sanitizing to the same result) would otherwise collide and fail the Run
 * gate's duplicate-name check.
 */
function sanitizeBlockNames(rawNames: readonly string[]): string[] {
  const used = new Set<string>();
  return rawNames.map((raw, i) => {
    const base = sanitizeBlockName(raw, `code${i + 1}`);
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${base}_${n}`;
      n++;
    }
    used.add(candidate);
    return candidate;
  });
}

/**
 * Convert imported code files into {@link Block}s: `address`/`bytes`
 * (and `entry`, when present) carry straight over, `kind` is always
 * `'code'`, `name` is sanitized and de-duplicated (see
 * {@link sanitizeBlockName}), and `id` is a deterministic `imported-code-<n>`
 * (1-based tape order) rather than a random UUID, so re-importing the same
 * image - and tests asserting on ids - get the same result every time.
 */
export function codeFilesToBlocks(
  codeFiles: readonly ImportedCodeFile[],
): Block[] {
  const names = sanitizeBlockNames(codeFiles.map((c) => c.name));
  return codeFiles.map((c, i) => ({
    id: `imported-code-${i + 1}`,
    name: names[i]!,
    address: c.address,
    bytes: c.bytes,
    kind: 'code' as const,
    ...(c.entry !== undefined ? { entry: c.entry } : {}),
  }));
}
