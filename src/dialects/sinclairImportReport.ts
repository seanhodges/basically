// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Shared import-fidelity notes for the Sinclair dialects (see
 * docs/contributing/charset-tokenizer-plan.md, Stage 2).
 *
 * The ZX80/ZX81 charset is now *total*: no byte is lost on import. But bytes
 * with no standard character - control codes, cursor codes, keyword tokens seen
 * as string data, or machine code stashed in a REM - come back as `\{NN}` raw
 * escapes. Surfacing how many keeps the import honest ("we kept every byte, but
 * N of them were non-printable") without pretending they were ordinary text.
 */

const RAW_ESCAPE = /\\\{[0-9A-Fa-f]{2}\}/g;

/** How many raw `\{NN}` byte escapes the decoded source contains. */
export function countRawEscapes(source: string): number {
  return (source.match(RAW_ESCAPE) ?? []).length;
}

/** One informational note when the import needed raw byte escapes. */
export function rawEscapeWarning(source: string): string[] {
  const n = countRawEscapes(source);
  if (n === 0) return [];
  const bytes = n === 1 ? 'byte' : 'bytes';
  const verb = n === 1 ? 'is' : 'are';
  return [
    `${n} ${bytes} had no standard character and ${verb} shown as \\{NN} ` +
      `escapes (control codes, embedded tokens or machine code).`,
  ];
}
