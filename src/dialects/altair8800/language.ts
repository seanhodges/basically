// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';

/**
 * CodeMirror language wiring for Altair 8K BASIC (Stage 1).
 *
 * Once `keywords.ts` is filled in, this becomes the usual three-line dialect
 * file: `buildCompletionSource(altair8800Keywords, constructsByDialect.altair8800,
 * { crunched })` and `buildBasicLanguage(...)` from `src/editor/`. The options
 * that need deciding for this machine, all from the MITS manual rather than a
 * sibling dialect:
 *
 * - `crunched` - Microsoft BASICs ignore spaces outside strings/REM and match
 *   the longest keyword at each position (`FORI=1TO10`), so this is almost
 *   certainly `true`, matching the C64 and TRS-80. Confirm against the 8K
 *   interpreter's CRUNCH routine before setting it.
 * - `suffixChars` - 8K BASIC has `$` for strings; it predates the `%`/`!`/`#`
 *   type tags Level II carries, so do not copy the TRS-80's set wholesale.
 * - `graphicsEscapes` - `false`. The machine has no graphics characters.
 * - `hexPrefix` / `binaryPrefix` - neither; 8K BASIC has no `&H` literals.
 *
 * Stage 1 also adds the `constructsByDialect.altair8800` entry to
 * `src/editor/constructs.ts` and the `altair8800VariableErrors` wrapper to
 * `src/editor/variableLint.ts`. Neither is registry-coupled, so both can land
 * before the dialect is registered.
 */

/** See the note above: expected `true`, pending confirmation from the ROM. */
export const altair8800Crunched = true;

export const altair8800CompletionSource: CompletionSource = () => {
  throw new Error('altair8800: not implemented');
};

export function altair8800LanguageSupport(): Extension {
  throw new Error('altair8800: not implemented');
}
