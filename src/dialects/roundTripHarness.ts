// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Import-direction round-trip harness.
 *
 * The acceptance rule for a binary program image fed to a dialect's importer:
 * `tokenize(detokenize(image))` reproduces the image **byte-for-byte with no
 * errors**, or the detokenize report carries a warning saying what was lost.
 * Anything else is silent corruption. `roundTrip.test.ts` applies the rule to
 * every registered dialect's samples; each dialect adds its own *foreign*
 * fixtures (control codes, tokens-in-strings, top-bit bytes) as its importer
 * learns to preserve or report them.
 */

import type { Dialect, TokenizeError } from './types';

export interface RoundTripOutcome {
  /** Editor text the image decoded to. */
  source: string;
  /** Warnings from `detokenizeWithReport` (empty when only `detokenize` exists). */
  warnings: string[];
  /** Errors from re-tokenizing the decoded text. */
  errors: TokenizeError[];
  /** True when re-tokenizing reproduced the original image byte-for-byte. */
  byteExact: boolean;
  /** The re-tokenized image, for failure diagnostics. */
  reImage: Uint8Array;
}

/** Decode an image to text, re-tokenize it, and compare the bytes. */
export function importRoundTrip(
  dialect: Dialect,
  image: Uint8Array,
): RoundTripOutcome {
  const { source, warnings } = dialect.detokenizeWithReport
    ? dialect.detokenizeWithReport(image)
    : { source: dialect.detokenize(image), warnings: [] };
  const result = dialect.tokenize(source);
  return {
    source,
    warnings,
    errors: result.errors,
    byteExact: equalBytes(result.image, image),
    reImage: result.image,
  };
}

/**
 * The import acceptance rule: lossless, or the loss was reported. Foreign
 * fixtures assert this; app-authored images must meet the stricter
 * `byteExact && errors.length === 0`.
 */
export function isAcceptableImport(outcome: RoundTripOutcome): boolean {
  return (
    (outcome.byteExact && outcome.errors.length === 0) ||
    outcome.warnings.length > 0
  );
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** First differing byte offset, for readable test failure messages. */
export function firstDifference(a: Uint8Array, b: Uint8Array): string {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      return `byte ${i}: 0x${a[i]!.toString(16)} != 0x${b[i]!.toString(16)}`;
    }
  }
  return `length ${a.length} != ${b.length}`;
}
