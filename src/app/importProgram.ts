// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Shared import step for every path that turns machine bytes back into editor
 * text (the Import dialog's binary buttons, drag-and-drop, cassette decode).
 * It prefers a dialect's own fidelity report (`detokenizeWithReport`) and adds
 * a dialect-agnostic check on top: text that comes *out* of an import should
 * always tokenize back *in* - when it doesn't, the file contained something
 * the dialect cannot represent yet, and the user must be told rather than
 * shown an unconditional "Imported." success.
 */

import type { Dialect, MemoryBlock } from '../dialects/types';

export interface ImportedProgram {
  source: string;
  /** Human-readable fidelity warnings; empty for a clean import. */
  warnings: string[];
  /**
   * Memory blocks the dialect's importer recovered alongside `source` (e.g.
   * CODE files in a Spectrum `.TAP`), when it supports {@link
   * Dialect.detokenizeWithReport}'s optional `blocks`. Absent when the
   * dialect found none, or reports none.
   */
  blocks?: MemoryBlock[];
}

/**
 * Dialect-agnostic fidelity check for just-imported text: empty output or
 * output that no longer tokenizes means the byte image held content the
 * current text form loses. Returns at most one summary warning.
 */
export function importFidelityWarnings(
  dialect: Dialect,
  source: string,
): string[] {
  if (!source.trim()) {
    return ['The file contained no program lines this dialect could read.'];
  }
  const { errors } = dialect.tokenize(source);
  if (errors.length === 0) return [];
  const first = errors[0]!;
  return [
    `The imported text has ${errors.length} error${errors.length > 1 ? 's' : ''} ` +
      `(first at line ${first.line}: ${first.message}) - the file may use bytes ` +
      `this dialect cannot represent yet.`,
  ];
}

/** Decode a binary program image into editor text plus fidelity warnings. */
export function importProgram(
  dialect: Dialect,
  bytes: Uint8Array,
): ImportedProgram {
  const base = dialect.detokenizeWithReport
    ? dialect.detokenizeWithReport(bytes)
    : { source: dialect.detokenize(bytes), warnings: [] };
  // The generic empty-output check is redundant when the dialect's own report
  // already explained why the import is empty (e.g. "not a BASIC program").
  const alreadyExplained = base.warnings.length > 0 && !base.source.trim();
  return {
    source: base.source,
    warnings: [
      ...base.warnings,
      ...(alreadyExplained ? [] : importFidelityWarnings(dialect, base.source)),
    ],
    ...(base.blocks ? { blocks: base.blocks } : {}),
  };
}

/** One status-bar line: "Imported x." or "Imported x, but: warning …". */
export function importStatusMessage(what: string, warnings: string[]): string {
  return warnings.length === 0
    ? `Imported ${what}.`
    : `Imported ${what}, but: ${warnings.join(' ')}`;
}
