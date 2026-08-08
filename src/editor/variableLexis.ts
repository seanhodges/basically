// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * What a variable name looks like on each machine, stated once.
 *
 * Three consumers need this and none of them can ask the `Dialect` for it: the
 * highlighter and completion bake it into `languageSupport()` per dialect
 * (`src/dialects/<id>/language.ts`), the variable lint next door needs it to
 * recognise a name at all, and the porting guide's program analyser
 * (`src/app/programVocabulary.ts`) needs it to report the names a program uses.
 * The lint used to spell its half out per family, which is two places for one
 * rule; this is the one.
 *
 * Only the fields that decide what a *name* is: the extra characters a name may
 * contain, the type markers that end one, the literal prefix whose digits must
 * not be read as a name, and whether the ROM crunches. `graphicsEscapes`,
 * `binaryPrefix` and `extraOperators` stay in each dialect's `language.ts` -
 * they style tokens rather than delimit names.
 *
 * `variableLexis.test.ts` requires an entry per registered machine, so the
 * omission that would read a BBC `MY_NAME` as two names fails the build.
 */
import type { EditorKeyword } from '../dialects/types';
import {
  buildIdentifierRegexes,
  type BasicLanguageOptions,
} from './basicLanguage';
import { makeCrunchMatcher } from './crunch';
import type { VarNameRules } from './variables';

/**
 * Dialect id → its name lexis. `{}` is a statement, not an omission: the
 * Sinclair machines take the defaults (`$` the only marker, no extra name
 * characters, no hex prefix, no crunching).
 */
export const VARIABLE_LEXIS: Record<string, BasicLanguageOptions> = {
  zx80: {},
  zx81: {},
  zxspectrum: {},
  zxspectrum128: {},
  // `_` is a name character here, and `&FF` a hex literal whose letters are not.
  bbcmicro: { nameChars: '_', suffixChars: '$%', hexPrefix: '&' },
  bbcmaster: { nameChars: '_', suffixChars: '$%', hexPrefix: '&' },
  // No markers at all: `$` is a prefix operator (`$addr`), and `#` opens a hex
  // literal where the other Acorn machine uses `&`.
  atom: { suffixChars: '', hexPrefix: '#' },
  commodore64: { suffixChars: '$%', crunched: true },
  pet: { suffixChars: '$%', crunched: true },
  vic20: { suffixChars: '$%', crunched: true },
  trs80: { suffixChars: '$%!#', crunched: true },
  // 8K BASIC predates the `%`/`!`/`#` type tags, so `$` is the only marker.
  altair8800: { suffixChars: '$', crunched: true },
  cpc464: { suffixChars: '$%!', hexPrefix: '&H?' },
  cpc6128: { suffixChars: '$%!', hexPrefix: '&H?' },
};

/** Build the variable scanner's rules from a lexis and the keyword table. */
export function variableRules(
  options: BasicLanguageOptions,
  keywords: EditorKeyword[],
): VarNameRules {
  const { headRe, varRe } = buildIdentifierRegexes(options);
  const words = keywords
    .filter((k) => /^[A-Z]/.test(k.word))
    .map((k) => k.word);
  const set = new Set(words);
  return {
    headRe,
    varRe,
    keywords: set,
    maxWordLen: words.length ? Math.max(...words.map((w) => w.length)) : 0,
    hexRe: options.hexPrefix
      ? new RegExp(`^${options.hexPrefix}[0-9A-Fa-f]+`)
      : null,
    callPrefixes: ['PROC', 'FN'].filter((w) => set.has(w)),
    crunch: options.crunched ? makeCrunchMatcher(set) : null,
  };
}

/**
 * The scanner's rules for a registered machine.
 *
 * An unknown id falls back to the defaults rather than throwing: the caller is
 * the program analyser, reached from a docs drawer that may be a build behind,
 * and reading a name as a Sinclair would beats reading none at all.
 */
export function variableRulesFor(
  dialectId: string,
  keywords: EditorKeyword[],
): VarNameRules {
  return variableRules(VARIABLE_LEXIS[dialectId] ?? {}, keywords);
}
