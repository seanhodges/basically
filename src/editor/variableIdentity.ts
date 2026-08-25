// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Whether two spellings are one variable, answered the way the machine answers
 * it - once, for everywhere the editor asks.
 *
 * Three things separate "the same spelling" from "the same variable":
 *
 * - **Case.** Most of these ROMs fold, so `score` and `SCORE` are one variable -
 *   but not Acorn's BBC BASIC and not BASIC-G, where they are two.
 * - **Significance.** Microsoft BASIC keeps two characters of a name, so on a
 *   C64, PET, VIC-20, TRS-80, Altair or PMD 85 `SCORE` and `SCOTT` are the same
 *   two bytes of RAM.
 * - **The type marker.** A marker names a separate table, so `A` and `A$` never
 *   merge however much of the name the ROM keeps.
 *
 * The two keys are separate because the checks need both: {@link nameKey} is
 * the variable the *program* means, and {@link identityKey} is the one the ROM
 * will actually hold. Two names that share an identity key but not a name key
 * are the silent collision the variable lint exists to report.
 */
import { foldNameCase } from '../dialects/letterCase';
import type { VariableLexis } from './variableLexis';

/** The name without its trailing type-marker character. */
function stripSuffix(name: string, suffixChars: string): string {
  const last = name[name.length - 1];
  return last && suffixChars.includes(last) ? name.slice(0, -1) : name;
}

/**
 * The variable the program means: case folded unless the ROM tells the two
 * apart, with the type marker still attached and nothing truncated.
 */
export function nameKey(name: string, lexis: VariableLexis): string {
  const cased = foldNameCase(name, lexis.caseSensitive ?? false);
  const suffixChars = lexis.suffixChars ?? '$';
  const bare = stripSuffix(cased, suffixChars);
  return bare + cased.slice(bare.length);
}

/**
 * The variable the ROM holds: {@link nameKey} cut to the characters the machine
 * actually keeps, marker included.
 */
export function identityKey(name: string, lexis: VariableLexis): string {
  const key = nameKey(name, lexis);
  const significant = lexis.significantChars;
  if (!significant) return key;
  const suffixChars = lexis.suffixChars ?? '$';
  const bare = stripSuffix(key, suffixChars);
  return bare.slice(0, significant) + key.slice(bare.length);
}

/** Whether the machine would store these two spellings as one variable. */
export function sameVariable(
  a: string,
  b: string,
  lexis: VariableLexis,
): boolean {
  return identityKey(a, lexis) === identityKey(b, lexis);
}
