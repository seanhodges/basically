// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Shared import-fidelity note for the ZX Spectrum dialects.
 *
 * The Spectrum charset is already total, but bytes with no ordinary character -
 * control codes, UDGs seen outside a string, or machine code stashed in a REM -
 * come back as `{0xNN}` raw escapes. Surfacing how many keeps the import honest
 * ("we kept every byte, but N of them were non-printable") without pretending
 * they were plain text. Structural problems (parity, truncation, extra files)
 * are reported separately by parseTapWithReport.
 */

const RAW_ESCAPE = /\{0x[0-9A-Fa-f]{2}\}/g;

/** How many raw `{0xNN}` byte escapes the decoded source contains. */
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
    `${n} ${bytes} had no standard character and ${verb} shown as {0xNN} ` +
      `escapes (control codes, UDGs or machine code).`,
  ];
}
