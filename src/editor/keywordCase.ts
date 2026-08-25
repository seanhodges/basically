// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The one thing three machines say about a keyword spelled in lower case.
 *
 * Where a machine's text encoding preserves lower case and its ROM's keyword
 * scan compares characters rather than folding them, a lower-case keyword is
 * not a keyword there - it is a name, and the program will not do what its
 * author meant. Which machines those are is derived, not opted into: see
 * `warnsOnLowerCaseKeyword` in {@link ../dialects/letterCase}.
 *
 * The message is shared so the three say the same thing; each tokenizer raises
 * it from its own scan, where the statement context lives. Every one of them is
 * non-fatal - it says what the machine will make of the program, and the author
 * decides.
 */

/**
 * How the message opens, for a caller that needs to find one rather than write
 * one - the declaration's own test, and any consumer that must tell this
 * advisory apart from a real error.
 */
export const LOWER_CASE_KEYWORD_HINT = 'Lower-case keyword';

/** The report for `typed` on `machine`, naming the spelling the ROM wants. */
export function lowerCaseKeywordMessage(
  typed: string,
  machine: string,
): string {
  return `${LOWER_CASE_KEYWORD_HINT} '${typed}' won't run on a real ${machine} — use ${typed.toUpperCase()}`;
}
