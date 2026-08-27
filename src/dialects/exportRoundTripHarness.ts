// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Export-direction round-trip harness: build a dialect's native export from a
 * whole document (BASIC source + memory blocks), feed the artifact back
 * through the dialect's importer, and report what survived.
 *
 * The acceptance rule for a block-aware export: the recovered source
 * re-tokenizes to the original program bytes with no errors, and every
 * memory block comes back with its address and bytes intact (names may pass
 * through the format's header rules - see the caller's per-dialect
 * normalization). Kept dialect-generic so dialects gain coverage by adding a
 * case to `blockExportRoundTrip.test.ts` as their block-aware export ships.
 */

import type { Dialect, Block, TapeFile, TokenizeError } from './types';

export interface ExportRoundTripOutcome {
  /** Editor text the exported artifact decoded back to. */
  source: string;
  /** Warnings from the importer. */
  warnings: string[];
  /** Memory blocks the importer recovered. */
  blocks: Block[];
  /** Extra tape files the importer preserved (an exported auto-loader). */
  tapeFiles: TapeFile[];
  /** Auto-start line the importer recovered, or null. */
  autoStart: number | null;
  /** Errors from re-tokenizing the recovered text. */
  errors: TokenizeError[];
  /**
   * True when the recovered text re-tokenizes to the original source's
   * program bytes byte-for-byte - the whole-image comparison of
   * `roundTripHarness` doesn't apply here because the export deliberately
   * differs from `tokenize().image` (program name, auto-start, extra files).
   */
  programByteExact: boolean;
}

/**
 * Run `source` + `blocks` through the dialect's file build target
 * (`targetId`), then import the artifact back. The target must produce a
 * single container artifact (the multi-file-download formats are deferred).
 */
export async function exportImportRoundTrip(
  dialect: Dialect,
  source: string,
  programName: string,
  blocks: readonly Block[],
  opts: { targetId: string; loader?: boolean },
): Promise<ExportRoundTripOutcome> {
  const target = dialect.buildTargets.find((t) => t.id === opts.targetId);
  if (!target) {
    throw new Error(`No build target "${opts.targetId}" for ${dialect.name}`);
  }
  const files = await target.build(source, {
    programName,
    blocks,
    loader: opts.loader ?? false,
  });
  if (files.length !== 1) {
    throw new Error(
      `Expected one container artifact from ${opts.targetId}, got ${files.length}`,
    );
  }
  const image = new Uint8Array(await files[0]!.blob.arrayBuffer());

  if (!dialect.detokenizeWithReport) {
    throw new Error(`${dialect.name} has no detokenizeWithReport importer`);
  }
  const report = dialect.detokenizeWithReport(image);
  const original = dialect.tokenize(source);
  const recovered = dialect.tokenize(report.source);
  return {
    source: report.source,
    warnings: report.warnings,
    blocks: report.blocks ?? [],
    tapeFiles: report.tapeFiles ?? [],
    autoStart: report.autoStart ?? null,
    errors: recovered.errors,
    programByteExact: equalBytes(recovered.programBytes, original.programBytes),
  };
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
