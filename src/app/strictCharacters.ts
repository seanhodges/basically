// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Strict characters: the conversion report, read as errors.
 *
 * With the setting off the IDE converts what the machine has not got and says
 * so in the status bar ({@link ./convertedCharacters}). With it on the same
 * findings become ordinary editor errors at their own positions, so a reader is
 * held to what the machine can actually store rather than having their listing
 * quietly rewritten.
 *
 * *The same* findings, deliberately: one detection escalated rather than a
 * second rule that answers a subtly different question. A count in the status
 * bar and a squiggle in the editor that disagreed about one program would be
 * the IDE giving two answers again.
 *
 * The findings are `fatal: false`, which is not a softening. Non-fatal errors
 * still block the Run gate and the share dialog, which is the point of the
 * setting; what `fatal` decides is whether `tokenize` could build an image at
 * all, and these characters build one perfectly well - the machine simply
 * stores something else. Export gates on fatal errors only, so it is unaffected
 * (see {@link ../dialects/types}'s `fatalErrors`).
 *
 * The setting arrives as a parameter rather than being read from the store, so
 * this stays a pure function of dialect, source and setting - testable, and
 * usable from the player and the docs bundle, which have no store.
 */
import type { Dialect, TokenizeError } from '../dialects/types';
import { convertedCharacters } from './convertedCharacters';

/**
 * The strict-mode errors for `source`, or none while the setting is off.
 *
 * `endColumn` covers the one character, so the squiggle marks the letter rather
 * than running to end of line.
 */
export function strictCharacterErrors(
  source: string,
  dialect: Dialect,
  strict: boolean,
): TokenizeError[] {
  if (!strict) return [];
  return convertedCharacters(source, dialect).findings.map((f) => ({
    line: f.line,
    column: f.column,
    endColumn: f.column + 1,
    message: `The ${dialect.name} has no "${f.from}" - it stores "${f.to}"`,
    fatal: false,
  }));
}
